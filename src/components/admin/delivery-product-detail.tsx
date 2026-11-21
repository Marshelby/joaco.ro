import { bloqueJornada, cuadriculaDetalleJornada, encabezadoProductoJornada, importeJornada, presentacionProductoJornada, tonoJornada } from "@/components/admin/jornada-colores";
import type { ContextoEntrega } from "@/lib/admin/entrega-contexto";
import type { ItemPreparacionPedidoAdmin, PedidoEntregaAdmin } from "@/lib/admin/pedidos";
import { formatearCantidadPreparacionEntrega } from "@/lib/delivery-preparation-quantity";
import { resolverModoCantidadPreparacion } from "@/lib/order-preparation";
import { formatCLP } from "@/lib/formatters";

const dinero = (n: number | null | undefined) => n != null && Number.isSafeInteger(n) && n >= 0 ? formatCLP(n) : "Sin importe histórico";
export function DeliveryProductDetail({ item: i, contexto, coloresLegacy = false, vistaRuta = false }: { item: ItemPreparacionPedidoAdmin; contexto: ContextoEntrega; coloresLegacy?: boolean; vistaRuta?: boolean }) {
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
  const importe = (valor: number | null | undefined) =>
    vistaRuta ? `${importeJornada} ${valor == null ? tonoJornada.informativo : tonoJornada.venta}` : undefined;
  const tonoEnvio = enviado == null ? tonoJornada.informativo
    : enviado === 0 || enviado !== i.cantidad ? tonoJornada.pendiente : tonoJornada.completado;
  return <li className={vistaRuta ? "min-w-0 space-y-1.5 py-2 text-sm wrap-anywhere" : "space-y-2 py-3 text-sm"}>
    <div className={vistaRuta ? encabezadoProductoJornada : undefined}><p className={vistaRuta ? "text-sm font-semibold" : "break-words font-medium"}>{i.nombreProducto}</p>{i.nombrePresentacion ? <p className={vistaRuta ? presentacionProductoJornada : "text-xs text-muted-foreground"}>{i.nombrePresentacion}</p> : null}</div>
    <p className="text-xs text-muted-foreground">Precio unitario histórico de referencia: {dinero(i.precioUnitarioHistorico)} · {resolverModoCantidadPreparacion(i) === "kg_fraccionable" ? "por KG" : "por unidad / presentación"}</p>
    <dl className={vistaRuta ? cuadriculaDetalleJornada : "grid grid-cols-3 gap-2 text-xs tabular-nums"}>
      <div className={vistaRuta ? `${bloqueJornada} ${tonoJornada.planificado}` : "min-w-0 rounded-md bg-muted/40 p-2"}><dt>Solicitado</dt><dd className="mt-1 break-words font-semibold">{formato(i.cantidad)}</dd></div>
      <div className={vistaRuta ? `${bloqueJornada} ${preparada == null ? tonoJornada.pendiente : tonoJornada.informativo}` : "min-w-0 rounded-md bg-muted/40 p-2"}><dt>Preparado</dt><dd className="mt-1 break-words font-semibold">{preparada == null ? "Sin preparar" : formato(preparada)}</dd></div>
      <div className={vistaRuta ? `${bloqueJornada} ${tonoEnvio}` : `min-w-0 rounded-md p-2 ring-1 ring-inset ${clase}`}><dt className="font-semibold">Enviado</dt><dd className="mt-1 break-words"><span className="block text-sm font-extrabold">{enviado == null ? "Sin dato" : formato(enviado)}</span><span className="mt-1 block text-[10px] font-semibold">{apariencia.texto}</span></dd></div>
    </dl>
    <p className="text-xs">Subtotal solicitado: <span className={importe(i.importeOriginal)}>{dinero(i.importeOriginal)}</span> · Subtotal enviado: <span className={importe(salida?.importe_linea_operativo)}>{dinero(salida?.importe_linea_operativo)}</span></p>
    {entrega ? <p className="text-xs font-semibold">Entregado al cliente: <span className={vistaRuta ? `${importeJornada} ${tonoJornada.completado}` : undefined}>{formato(entrega.cantidad_entregada)}</span> · Subtotal entregado: <span className={importe(entrega.importe_definitivo)}>{dinero(entrega.importe_definitivo)}</span></p> : null}
    <p className="text-[11px] text-muted-foreground">Importes autorizados históricos; los ajustes de línea no se prorratean.</p>
  </li>;
}

export function DeliveryOrderTotals({ pedido, vistaRuta = false }: { pedido: PedidoEntregaAdmin; vistaRuta?: boolean }) {
  const salida = pedido.contextoEntrega.salida;
  const completa = salida && salida.length === pedido.items.length && pedido.items.every(i => salida.some(p => p.item_pedido_id === i.id && p.importe_linea_operativo != null));
  const subtotal = salida && completa ? salida.reduce((s, p) => s + p.importe_linea_operativo!, 0) : null;
  const importe = (tono: keyof typeof tonoJornada) => vistaRuta ? `${importeJornada} ${tonoJornada[tono]}` : undefined;
  return <div className={vistaRuta ? "space-y-1 border-t border-border py-2 text-xs tabular-nums wrap-anywhere" : "space-y-1 border-t border-border py-3 text-sm tabular-nums"}>
    <p>Total solicitado del pedido: <strong className={importe("informativo")}>{dinero(pedido.total)}</strong></p>
    <p>Subtotal productos enviados: <strong className={importe(subtotal == null ? "informativo" : "venta")}>{dinero(subtotal)}</strong></p>
    <p>Total efectivamente entregado (incluye despacho y descuento): <strong className={importe(pedido.contextoEntrega.venta?.total == null ? "informativo" : "venta")}>{dinero(pedido.contextoEntrega.venta?.total)}</strong></p>
  </div>;
}
