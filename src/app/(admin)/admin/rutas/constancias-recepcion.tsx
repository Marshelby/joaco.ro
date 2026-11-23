import { leerPorIds, type PedidoEntregaAdmin } from "@/lib/admin/pedidos";
import type { ResultadoEntrega } from "@/lib/admin/resultado-entrega";
import { exigirSesionAdmin } from "@/lib/admin/sesion";
import { formatearCantidadPreparacionEntrega } from "@/lib/delivery-preparation-quantity";
import { formatCLP } from "@/lib/formatters";
import { formatearFechaCalendario } from "@/lib/operational-date";
import { ConstanciasRecepcionDialog } from "./constancias-recepcion-dialog";
import type { PedidoConstancia } from "./constancias-recepcion-pdf";

type Venta = { total: number | null; productos: ResultadoEntrega["productos"] };
type VentaPedido = { id: string; venta: Venta | null; correcciones_venta_entregada: { venta: Venta | null }[] };

function monto(valor: number | null | undefined) {
  return valor != null && Number.isSafeInteger(valor) && valor >= 0 ? valor : null;
}

function dinero(valor: number | null) {
  return valor === null ? "Pendiente" : formatCLP(valor);
}

function prepararConstancia(pedido: PedidoEntregaAdmin, respaldo?: Venta | null): PedidoConstancia {
  const entregado = pedido.estado === "entregado";
  const venta = pedido.resultadoEntrega
    ? { total: pedido.resultadoEntrega.definitivo, productos: pedido.resultadoEntrega.productos }
    : respaldo;
  const entregas = new Map(Array.isArray(venta?.productos) ? venta.productos.map(item => [item.item_pedido_id, item]) : []);
  const salidas = new Map(pedido.contextoEntrega.salida?.map(item => [item.item_pedido_id, item]));
  const cierreHistorico = !entregado && pedido.subtotalFinal !== null && pedido.totalFinal !== null;
  const importes: number[] = [];
  const productos = pedido.items.map(item => {
    const preparada = item.confirmadoExplicito ? item.cantidadPreparada : null;
    const salida = salidas.get(item.id);
    const entrega = entregas.get(item.id);
    const confirmada = !!salida || item.confirmadoExplicito || cierreHistorico;
    const cantidad = entregado ? entrega?.cantidad_entregada : salida?.cantidad_preparada
      ?? (item.confirmadoExplicito ? preparada : cierreHistorico ? item.cantidadPreparada ?? item.cantidad : item.cantidad);
    const cantidadValida = cantidad != null && Number.isFinite(cantidad) && cantidad >= 0;
    const importeHistorico = cantidad === item.cantidad ? item.importeOriginal
      : item.importeCalculado == null ? null : Number(item.importeCalculado);
    const importe = cantidadValida ? monto(entregado ? entrega?.importe_definitivo
      : salida ? salida.importe_linea_operativo : item.confirmadoExplicito ? item.importeOperativo : importeHistorico) : null;
    if (importe !== null) importes.push(importe);
    const formatoCantidad = (valor: number) =>
      formatearCantidadPreparacionEntrega(valor, item.nombrePresentacion, item.unidad, item.modoCantidadSnapshot);
    const acuerdoPorLinea = item.totalFinalAdministrativo != null || entrega?.total_final_administrativo != null;
    return {
      nombre: item.nombreProducto,
      presentacion: item.nombrePresentacion,
      cantidad: formatoCantidad(preparada ?? item.cantidad),
      fuente: preparada === null ? "Pedido original" : "Preparación confirmada",
      conPrecios: {
        cantidad: cantidadValida ? formatoCantidad(cantidad) : "Pendiente",
        fuente: entregado ? "Cantidad entregada" : confirmada ? "Preparación confirmada" : "Pedido original",
        precioUnitario: acuerdoPorLinea ? "Acuerdo por línea" : dinero(monto(entrega?.precio_final_unitario_referencia ?? item.precioUnitarioHistorico)),
        importe: dinero(importe),
      },
    };
  });
  const sumaLineas = productos.length > 0 && importes.length === productos.length && (!entregado || entregas.size === productos.length)
    ? monto(importes.reduce((suma, importe) => suma + importe, 0)) : null;
  const subtotal = cierreHistorico && pedido.importeOperativoPreparacion == null
    ? monto(pedido.subtotalFinal) : sumaLineas;
  const despacho = monto(pedido.costoEntrega);
  const descuento = monto(pedido.descuento);
  const suma = subtotal !== null && despacho !== null && descuento !== null ? monto(subtotal + despacho) : null;
  const calculado = suma !== null && descuento !== null ? suma - descuento : null;
  const preparado = productos.some(p => p.conPrecios.fuente === "Preparación confirmada");
  const referencia = entregado ? venta?.total : preparado ? pedido.importeOperativoPreparacion ?? pedido.totalFinal : pedido.total;
  const registrado = monto(referencia);
  // El mínimo de cero en preparación sólo se acepta cuando coincide con el total operativo.
  const total = calculado === registrado ? registrado
    : !entregado && preparado && registrado === 0 && calculado !== null && calculado < 0 ? registrado
      : !entregado && preparado && referencia == null ? monto(calculado) : null;
  const estadoTotal = entregado ? total === null ? "" : " definitivo" : " estimado";
  const resumen: [string, string][] = [["Subtotal", dinero(subtotal)]];
  if (despacho !== 0) resumen.push(["Despacho", dinero(despacho)]);
  if (descuento !== 0) resumen.push(["Descuento", dinero(descuento)]);
  resumen.push([`Total${estadoTotal}`, dinero(total)]);
  return {
    id: pedido.id,
    numero: pedido.numeroPedido,
    destinatario: pedido.destinatarioEntrega?.trim() || pedido.nombreClienteSnapshot,
    direccion: pedido.direccionEntregaSnapshot || pedido.nombreUbicacionSnapshot || "Sin dirección registrada",
    productos,
    resumen,
  };
}

export async function ConstanciasRecepcion({ fecha, pedidos }: { fecha: string; pedidos: readonly PedidoEntregaAdmin[] }) {
  const fechaProgramada = formatearFechaCalendario(fecha, { dateStyle: "long" });
  const faltantes = pedidos.filter(pedido => pedido.estado === "entregado" && !pedido.resultadoEntrega);
  const ventas = new Map<string, Venta | null>();
  if (faltantes.length) {
    const db = await exigirSesionAdmin();
    const resultado = await leerPorIds(faltantes.map(pedido => pedido.id), (lote, desde, hasta) => db.from("pedidos")
      .select("id,venta:venta_definitiva_snapshot,correcciones_venta_entregada(venta:nuevos)")
      .eq("fecha_entrega", fecha).eq("estado", "entregado").in("id", lote).order("id")
      .order("version", { referencedTable: "correcciones_venta_entregada", ascending: false })
      .limit(1, { referencedTable: "correcciones_venta_entregada" }).range(desde, hasta)).catch(() => null);
    for (const fila of (resultado?.data ?? []) as unknown as VentaPedido[]) {
      if (!Array.isArray(fila.correcciones_venta_entregada)) continue;
      const correccion = fila.correcciones_venta_entregada[0];
      ventas.set(fila.id, correccion ? correccion.venta : fila.venta);
    }
  }
  return <ConstanciasRecepcionDialog fecha={fecha} fechaProgramada={fechaProgramada}
    pedidos={pedidos.map(pedido => prepararConstancia(pedido, ventas.get(pedido.id)))} />;
}
