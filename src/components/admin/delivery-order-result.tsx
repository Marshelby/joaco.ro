import type { ReactNode } from "react";
import { DeliveryResultDetails, importeResultado, presentarResultadoEntrega, productoSolicitado } from "@/components/admin/delivery-result";
import { RutasContabilidadPedido } from "@/components/admin/rutas-contabilidad";
import { formatCLP } from "@/lib/formatters";
import { obtenerUltimoFalloEntrega } from "@/lib/admin/intentos-entrega";
import type { PedidoEntregaAdmin } from "@/lib/admin/pedidos";
import type { ContabilidadRutaPedido } from "@/lib/admin/rutas-contabilidad";

export function presentarResultadoJornada(pedido: PedidoEntregaAdmin, contabilidad?: ContabilidadRutaPedido | null) {
  const productos = pedido.items.map(p => productoSolicitado(p.id, p.nombreProducto, p.nombrePresentacion, p.unidad, p.cantidad, p.importeOriginal));
  const datos = presentarResultadoEntrega(pedido.estado, pedido.total, pedido.resultadoEntrega, productos, pedido.contextoEntrega);
  return { datos, importe: importeResultado(datos, contabilidad?.venta_reconocida ? contabilidad.importe_definitivo : null) };
}

export async function DeliveryOrderResultDetails({ pedido, datos, contabilidad, children }: {
  pedido: PedidoEntregaAdmin;
  datos: ReturnType<typeof presentarResultadoJornada>["datos"];
  contabilidad?: ContabilidadRutaPedido | null;
  children?: ReactNode;
}) {
  const fallo = datos.tipo === "fallida" ? await obtenerUltimoFalloEntrega(pedido.id) : null;
  const sinStock = datos.tipo === "fallida" ? pedido.historialPreparacion.filter(h => h.valores_nuevos.origen === "sin_stock_pre_despacho").at(-1) : undefined;
  const cobrado = pedido.resultadoEntrega?.total_cobrado ?? null;
  return <DeliveryResultDetails datos={datos} contexto={pedido.contextoEntrega} fallo={fallo ?? (sinStock ? {
    motivo: sinStock.motivo, observaciones: null, fecha: sinStock.fecha, actor: sinStock.actorNombre ?? null,
  } : null)}>
    {pedido.nombreUbicacionSnapshot && <p className="text-xs text-muted-foreground">{pedido.nombreUbicacionSnapshot}</p>}
    {!contabilidad?.venta_reconocida && cobrado != null && <p>Total cobrado en la entrega · <strong>{formatCLP(cobrado)}</strong></p>}
    <RutasContabilidadPedido resumen={contabilidad} totalCobrado={cobrado} ocultarImporte={datos.tipo !== "fallida"} />
    {children}
  </DeliveryResultDetails>;
}
