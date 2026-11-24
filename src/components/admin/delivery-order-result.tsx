import { importeJornada, tonoJornada } from "@/components/admin/jornada-colores";
import type { ReactNode } from "react";
import { DeliveryResultDetails, importeResultado, presentarResultadoEntrega, productoSolicitado } from "@/components/admin/delivery-result";
import { RutasContabilidadPedido } from "@/components/admin/rutas-contabilidad";
import { formatCLP } from "@/lib/formatters";
import type { PedidoEntregaAdmin } from "@/lib/admin/pedidos";
import type { ContabilidadRutaPedido } from "@/lib/admin/rutas-contabilidad";

export function presentarResultadoJornada(pedido: PedidoEntregaAdmin, contabilidad?: ContabilidadRutaPedido | null) {
  const productos = pedido.items.map(p => productoSolicitado(p.id, p.nombreProducto, p.nombrePresentacion, p.unidad, p.cantidad, p.importeOriginal));
  const datos = presentarResultadoEntrega(pedido.estado, pedido.total, pedido.resultadoEntrega, productos, pedido.contextoEntrega);
  return { datos, importe: importeResultado(datos, contabilidad?.venta_reconocida ? contabilidad.importe_definitivo : null) };
}

export function DeliveryOrderResultDetails({ pedido, datos, contabilidad, vistaRuta = false, children }: {
  pedido: PedidoEntregaAdmin;
  datos: ReturnType<typeof presentarResultadoJornada>["datos"];
  contabilidad?: ContabilidadRutaPedido | null;
  vistaRuta?: boolean;
  children?: ReactNode;
}) {
  const fallo = datos.tipo === "fallida" ? pedido.falloEntrega : null;
  const sinStock = datos.tipo === "fallida" ? pedido.historialPreparacion.find(h => h.valores_nuevos.origen === "sin_stock_pre_despacho") : undefined;
  const cobrado = pedido.resultadoEntrega?.total_cobrado ?? null;
  return <DeliveryResultDetails vistaRuta={vistaRuta} datos={datos} contexto={pedido.contextoEntrega} fallo={fallo ?? (sinStock ? {
    motivo: sinStock.motivo, observaciones: null, fecha: sinStock.fecha, actor: sinStock.actorNombre ?? null,
  } : null)}>
    {pedido.nombreUbicacionSnapshot && <p className="text-xs text-muted-foreground">{pedido.nombreUbicacionSnapshot}</p>}
    {!contabilidad?.venta_reconocida && cobrado != null && <p>Total cobrado en la entrega · <strong className={vistaRuta ? `${importeJornada} ${tonoJornada.completado}` : undefined}>{formatCLP(cobrado)}</strong></p>}
    <RutasContabilidadPedido vistaRuta={vistaRuta} resumen={contabilidad} totalCobrado={cobrado} ocultarImporte={datos.tipo !== "fallida"} />
    {children}
  </DeliveryResultDetails>;
}
