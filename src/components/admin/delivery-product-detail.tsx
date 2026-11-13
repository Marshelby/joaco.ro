import type { ContextoEntrega } from "@/lib/admin/entrega-contexto";
import type { ItemPreparacionPedidoAdmin, PedidoEntregaAdmin } from "@/lib/admin/pedidos";
import { formatearCantidadPreparacionEntrega } from "@/lib/delivery-preparation-quantity";
import { resolverModoCantidadPreparacion } from "@/lib/order-preparation";
import { formatCLP } from "@/lib/formatters";

const dinero = (n: number | null | undefined) => n != null && Number.isSafeInteger(n) && n >= 0 ? formatCLP(n) : "Sin importe histórico";
export function DeliveryProductDetail({ item: i, contexto, coloresLegacy = false }: { item: ItemPreparacionPedidoAdmin; contexto: ContextoEntrega; coloresLegacy?: boolean }) {
  const salida = contexto.salida?.find(p => p.item_pedido_id === i.id);
  const entrega = contexto.venta?.productos.find(p => p.item_pedido_id === i.id);
  const enviado = salida?.cantidad_preparada;
  const preparada = salida?.cantidad_preparada ?? i.cantidadPreparada;
  const formato = (n: number) => formatearCantidadPreparacionEntrega(n, i.nombrePresentacion, i.unidad, i.modoCantidadSnapshot);
  const apariencia = enviado == null ? { clase: "bg-muted/40 text-muted-foreground", texto: "Sin registro histórico" }
    : enviado === 0 ? { clase: "bg-red-50 text-red-900 ring-red-200", texto: "Sin envío" }
    : enviado < i.cantidad ? { clase: "bg-yellow-100 text-yellow-900 ring-yellow-300", texto: "Parcial" }
    : enviado === i.cantidad ? { clase: "bg-emerald-50 text-emerald-900 ring-emerald-200", texto: "Completo" }
    : { clase: "bg-lime-400 text-green-950 ring-lime-500", texto: "Excedente" };
  const clase = coloresLegacy && enviado != null
    ? enviado === 0 ? "bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-200"
      : enviado < i.cantidad ? "bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
      : enviado > i.cantidad ? "bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-200"
      : "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
    : apariencia.clase;
  return <li className="space-y-2 py-3 text-sm">
    <div><p className="break-words font-medium">{i.nombreProducto}</p>{i.nombrePresentacion ? <p className="text-xs text-muted-foreground">{i.nombrePresentacion}</p> : null}</div>
    <p className="text-xs text-muted-foreground">Precio unitario histórico de referencia: {dinero(i.precioUnitarioHistorico)} · {resolverModoCantidadPreparacion(i) === "kg_fraccionable" ? "por KG" : "por unidad / presentación"}</p>
    <dl className="grid grid-cols-3 gap-2 text-xs tabular-nums">
      <div className="min-w-0 rounded-md bg-muted/40 p-2"><dt>Solicitado</dt><dd className="mt-1 break-words font-semibold">{formato(i.cantidad)}</dd></div>
      <div className="min-w-0 rounded-md bg-muted/40 p-2"><dt>Preparado</dt><dd className="mt-1 break-words font-semibold">{preparada == null ? "Sin preparar" : formato(preparada)}</dd></div>
      <div className={`min-w-0 rounded-md p-2 ring-1 ring-inset ${clase}`}><dt className="font-semibold">Enviado</dt><dd className="mt-1 break-words"><span className="block text-sm font-extrabold">{enviado == null ? "Sin dato" : formato(enviado)}</span><span className="mt-1 block text-[10px] font-semibold">{apariencia.texto}</span></dd></div>
    </dl>
    <p className="text-xs">Subtotal solicitado: {dinero(i.importeOriginal)} · Subtotal enviado: {dinero(salida?.importe_linea_operativo)}</p>
    {entrega ? <p className="text-xs font-semibold">Entregado al cliente: {formato(entrega.cantidad_entregada)} · Subtotal entregado: {dinero(entrega.importe_definitivo)}</p> : null}
    <p className="text-[11px] text-muted-foreground">Importes autorizados históricos; los ajustes de línea no se prorratean.</p>
  </li>;
}

export function DeliveryOrderTotals({ pedido }: { pedido: PedidoEntregaAdmin }) {
  const salida = pedido.contextoEntrega.salida;
  const completa = salida && salida.length === pedido.items.length && pedido.items.every(i => salida.some(p => p.item_pedido_id === i.id && p.importe_linea_operativo != null));
  const subtotal = salida && completa ? salida.reduce((s, p) => s + p.importe_linea_operativo!, 0) : null;
  return <div className="space-y-1 border-t border-border py-3 text-sm tabular-nums">
    <p>Total solicitado del pedido: <strong>{dinero(pedido.total)}</strong></p>
    <p>Subtotal productos enviados: <strong>{dinero(subtotal)}</strong></p>
    <p>Total efectivamente entregado (incluye despacho y descuento): <strong>{dinero(pedido.contextoEntrega.venta?.total)}</strong></p>
  </div>;
}
