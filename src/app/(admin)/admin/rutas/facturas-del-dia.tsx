import { formatFechaEntregaLarga } from "@/lib/delivery-date";
import { camposFacturacion, type DatosFacturacion } from "@/lib/admin/cliente-facturacion";
import { leerPorIds, type PedidoEntregaAdmin } from "@/lib/admin/pedidos";
import { exigirSesionAdmin } from "@/lib/admin/sesion";
import type { ResultadoEntrega } from "@/lib/admin/resultado-entrega";
import { getClosedPresentationKind } from "@/lib/cart-quantity";
import { resolverModoCantidadPreparacion } from "@/lib/order-preparation";
import { OrderStatusBadge } from "@/components/admin/order-status-badge";
import { PreparationStatusBadge } from "@/components/order/preparation-status-badge";
import { FacturasDelDiaDialog, type PedidoFactura } from "./facturas-del-dia-dialog";

function datoNumerico(valor: number | null | undefined) {
  return typeof valor === "number" && Number.isFinite(valor) && valor >= 0 ? String(valor) : null;
}

type ProductoEntrega = ResultadoEntrega["productos"][number];
type VentaRegistrada = {
  id: string;
  productos_entrega: ProductoEntrega[] | null;
  correcciones_venta_entregada: { productos: ProductoEntrega[] | null }[];
};

function productosFactura(pedido: PedidoEntregaAdmin, venta?: VentaRegistrada): PedidoFactura["productos"] {
  const entregado = pedido.estado === "entregado";
  const correccion = venta?.correcciones_venta_entregada[0];
  const productosEntrega = pedido.resultadoEntrega?.productos ?? (correccion ? correccion.productos : venta?.productos_entrega);
  const resultados = new Map(Array.isArray(productosEntrega) ? productosEntrega.map(item => [item.item_pedido_id, item]) : []);
  return pedido.items.map(item => {
    const entrega = resultados.get(item.id);
    const preparado = item.confirmadoExplicito && item.cantidadPreparada !== null;
    const cantidad = datoNumerico(entregado ? entrega?.cantidad_entregada : preparado ? item.cantidadPreparada : null);
    const importeRegistrado = entregado ? entrega?.importe_definitivo : preparado ? item.importeOperativo : null;
    const importe = Number.isSafeInteger(importeRegistrado) ? datoNumerico(importeRegistrado) : null;
    const precio = cantidad !== null && item.totalFinalAdministrativo === null
      ? datoNumerico(entrega?.precio_final_unitario_referencia ?? item.precioUnitarioHistorico)
      : null;
    const modo = resolverModoCantidadPreparacion(item);
    const unidad = modo === "presentacion_cerrada"
      ? getClosedPresentationKind(item.nombrePresentacion ?? "") ?? "Presentación"
      : modo === "kg_fraccionable" ? item.unidad : "Unidad";

    return {
      id: item.id,
      estado: entregado
        ? cantidad !== null && importe !== null ? "Entrega registrada" : "Detalle de entrega incompleto"
        : preparado ? "Preparación confirmada · Sujeta a diferencias de entrega" : "Pendiente de preparación",
      campos: [
        { id: "nombre", etiqueta: "Producto", valor: [item.nombreProducto, item.nombrePresentacion].filter(Boolean).join(" · ") },
        { id: "cantidad", etiqueta: entregado ? "Cantidad entregada" : "Cantidad preparada", valor: cantidad },
        { id: "unidad", etiqueta: "Unidad", valor: unidad },
        { id: "precio", etiqueta: "Precio unitario de venta (CLP)", valor: precio,
          ausente: cantidad !== null && item.totalFinalAdministrativo != null ? "Acuerdo por importe de línea" : undefined },
        { id: "importe", etiqueta: entregado ? "Importe final de línea (CLP)" : "Importe preparado de línea (CLP)", valor: importe },
      ],
    };
  });
}

export async function FacturasDelDia({ fecha, pedidos }: { fecha: string; pedidos: readonly PedidoEntregaAdmin[] }) {
  const db = await exigirSesionAdmin();
  const candidatos = pedidos.filter(pedido => pedido.fechaEntrega === fecha && pedido.estado !== "cancelado");
  const ids = [...new Set(candidatos.flatMap(pedido => pedido.clienteId ? [pedido.clienteId] : []))];
  const fechaVisible = formatFechaEntregaLarga(fecha);
  const fichas = await leerPorIds(ids, (lote, desde, hasta) => db.from("clientes_datos_facturacion")
    .select("cliente_id,rut,razon_social,giro_comercial,direccion_tributaria,comuna,ciudad,correo_facturacion")
    .in("cliente_id", lote).order("cliente_id").range(desde, hasta)).catch(() => null);

  if (!fichas) return <FacturasDelDiaDialog key={fecha} fecha={fechaVisible} pedidos={[]} errorConsulta />;
  const porCliente = new Map((fichas.data as (DatosFacturacion & { cliente_id: string })[]).map(ficha => [ficha.cliente_id, ficha]));
  const faltanResultados = candidatos.filter(pedido =>
    pedido.estado === "entregado" && !pedido.resultadoEntrega && pedido.clienteId && porCliente.has(pedido.clienteId));
  // El snapshot original sólo se usa tras consultar también la última corrección.
  const ventas = await leerPorIds(faltanResultados.map(pedido => pedido.id), (lote, desde, hasta) => db.from("pedidos")
    .select("id,productos_entrega:venta_definitiva_snapshot->productos,correcciones_venta_entregada(productos:nuevos->productos)")
    .eq("fecha_entrega", fecha).eq("estado", "entregado").in("id", lote).order("id")
    .order("version", { referencedTable: "correcciones_venta_entregada", ascending: false })
    .limit(1, { referencedTable: "correcciones_venta_entregada" }).range(desde, hasta)).catch(() => null);
  const ventasPorPedido = new Map(((ventas?.data ?? []) as unknown as VentaRegistrada[]).map(venta => [venta.id, venta]));

  const facturas: PedidoFactura[] = candidatos.flatMap(pedido => {
    const ficha = pedido.clienteId ? porCliente.get(pedido.clienteId) : undefined;
    if (!ficha) return [];
    return [{
      id: pedido.id,
      numero: pedido.numeroPedido,
      cliente: pedido.nombreClienteSnapshot,
      estado: <><OrderStatusBadge estado={pedido.estado} />{!["en_reparto", "entregado", "entrega_fallida"].includes(pedido.estado)
        && <PreparationStatusBadge estado={pedido.preparacionEstado} />}</>,
      tributarios: camposFacturacion.map(({ nombre, etiqueta }) => ({ id: nombre, etiqueta, valor: ficha[nombre] })),
      productos: productosFactura(pedido, ventasPorPedido.get(pedido.id)),
    }];
  });

  return <FacturasDelDiaDialog key={fecha} fecha={fechaVisible} pedidos={facturas} />;
}
