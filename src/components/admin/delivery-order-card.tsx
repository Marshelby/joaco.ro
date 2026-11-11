import { obtenerPermisoTemporalPreparacion } from "@/lib/order-preparation";
import { OrderIdentity } from "@/components/admin/order-identity";
import { CheckCircle2, ChevronDown } from "lucide-react";

import { OrderOperationalAction } from "@/components/admin/order-operational-action";
import { PreparationItemControl } from "@/components/admin/preparation-item-control";
import { PreparationCompactItemControl } from "@/components/admin/preparation-compact-item-control";
import { SinStockAction } from "@/components/admin/sin-stock-action";
import { FinalizePreparationAction } from "@/components/admin/finalize-preparation-action";
import { PreparationStatusBadge } from "@/components/order/preparation-status-badge";
import { OrderStatusBadge } from "@/components/admin/order-status-badge";
import { CustomerQuickViewDialog } from "@/components/admin/customer-quick-view-dialog";
import { DeliveryContactActions } from "@/components/admin/delivery-contact-actions";
import { ActionLink } from "@/components/ui/action-link";
import { ROUTES } from "@/config/routes";
import { type PedidoEntregaAdmin } from "@/lib/admin/pedidos";
import { formatCLP, formatDateTimeCL } from "@/lib/formatters";

function valoresRevision(valores: Record<string, unknown>) {
  const cantidad = valores.cantidad_preparada;
  const importe = valores.importe_linea_operativo;
  if ("estado" in valores) return `Estado: ${String(valores.estado)}`;
  return `${valores.confirmado_explicito ? "LISTO" : "PENDIENTE"} · Cantidad preparada: ${cantidad == null ? "sin confirmación" : String(cantidad)} · Importe operativo: ${typeof importe === "number" ? formatCLP(importe) : "sin confirmación"}`;
}

export function DeliveryOrderCard({ pedido, nombreEmisor, operativa = false, numeroPreparacion, rutaMultiple = false, soloLecturaRuta = false }: { pedido: PedidoEntregaAdmin; nombreEmisor?: string | null; operativa?: boolean; numeroPreparacion?: number; rutaMultiple?: boolean; soloLecturaRuta?: boolean }) {
  const permisoPreparacion = obtenerPermisoTemporalPreparacion(pedido.fechaEntrega);
  const requierePreparacion = pedido.estado === "confirmado" || pedido.estado === "preparando";
  const pendienteDeConfirmacion = pedido.estado === "recibido";
  const listoParaDespacho = pedido.estado === "listo_despacho";
  const telefonoEntrega = pedido.telefonoContactoEntregaSnapshot ?? pedido.telefonoClienteSnapshot;

  const compacta = numeroPreparacion !== undefined;
  const Contenedor = compacta ? "details" : "div";
  const ContenedorProductos = compacta ? "div" : "details";
  const ControlProducto = compacta ? PreparationCompactItemControl : PreparationItemControl;
  // El encabezado cuenta únicamente cantidades persistidas, sin depender de la confirmación final.
  const preparados = pedido.items.filter((item) => item.cantidadPreparada !== null && item.cantidadPreparada >= item.cantidad).length;

  const estadoCantidad = !pedido.items.length || pedido.items.every(i => (i.cantidadPreparada ?? 0) === 0)
    ? "Sin preparar" : preparados === pedido.items.length ? "Listo" : "Parcial";

  return (
    <li data-preparacion-pedido={pedido.id} className={compacta ? "overflow-hidden rounded-xl border border-border bg-card" : "rounded-xl border border-border bg-card p-4 sm:p-5"}>
      {/* El desplegable oculta el contenido sin desmontar los controles en edición. */}
      <Contenedor className={compacta ? "group/preparacion" : undefined}>
        {compacta ? <summary className="grid min-h-20 cursor-pointer list-none grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-3 py-3 outline-none transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50 md:grid-cols-[2rem_minmax(0,1fr)_auto_9rem_auto] [&::-webkit-details-marker]:hidden">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">{numeroPreparacion}</span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold" title={pedido.nombreClienteSnapshot}>{pedido.nombreClienteSnapshot}</span>
            <span className="block truncate text-xs text-muted-foreground" title={pedido.nombreUbicacionSnapshot ?? undefined}>{pedido.nombreUbicacionSnapshot?.trim() || "Sin ubicación comercial registrada"}</span>
            <span className="block text-[11px] text-muted-foreground"><span className="sr-only">Pedido </span>{pedido.numeroPedido}</span>
          </span>
          <span className="col-start-2 flex flex-wrap gap-1 md:col-start-auto"><OrderStatusBadge estado={pedido.estado} />{rutaMultiple ? <span className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold ${estadoCantidad === "Listo" ? "bg-emerald-100 text-emerald-900" : "bg-muted text-foreground"}`}>{estadoCantidad === "Listo" && <CheckCircle2 className="size-4" aria-hidden="true" />}{estadoCantidad}</span> : <PreparationStatusBadge estado={pedido.preparacionEstado} />}</span>
          <span className="col-start-2 space-y-1 text-xs text-muted-foreground md:col-start-auto">
            <span className="block">{preparados} / {pedido.items.length} preparados</span>
            <progress className="block h-1.5 w-full accent-primary" aria-label={`Preparación de ${pedido.numeroPedido}`} max={Math.max(pedido.items.length, 1)} value={preparados} />
          </span>
          <ChevronDown className="col-start-3 row-start-1 size-4 text-muted-foreground transition-transform group-open/preparacion:rotate-180 md:col-start-5" aria-hidden="true" />
        </summary> : null}
        <div id={`preparacion-${pedido.id}`} className={compacta ? "scroll-mt-24 border-t border-border p-4 sm:p-5" : "scroll-mt-24"}>
          <div className="grid gap-4 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] xl:grid-cols-[minmax(0,1.5fr)_minmax(10rem,1fr)_auto_auto] md:items-center md:gap-6">
            <div className="min-w-0">
              <OrderIdentity pedido={pedido} customerAction={pedido.clienteId ? <CustomerQuickViewDialog clienteId={pedido.clienteId} nombre={pedido.nombreClienteSnapshot} /> : undefined} />
              {pedido.destinatarioEntrega ? <p className="mt-3 break-words text-sm leading-6 text-muted-foreground">Destinatario: {pedido.destinatarioEntrega}</p> : null}
              {pedido.zonaEntrega ? <p className="mt-1 text-sm text-muted-foreground">Zona: {pedido.zonaEntrega}</p> : null}
            </div>
            {!compacta ? <><dl className="grid grid-cols-2 gap-3 text-sm sm:block">
              <div><dt className="text-muted-foreground">Creado</dt><dd className="mt-1 font-medium text-foreground">{formatDateTimeCL(pedido.fechaCreacion)}</dd></div>
              <div className="sm:mt-2"><dt className="text-muted-foreground">Total original</dt><dd className="mt-1 font-semibold text-foreground">{formatCLP(pedido.total)}</dd></div>
            </dl>
            <div className="flex flex-wrap gap-2"><OrderStatusBadge estado={pedido.estado} />{rutaMultiple ? <span className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold ${estadoCantidad === "Listo" ? "bg-emerald-100 text-emerald-900" : "bg-muted text-foreground"}`}>{estadoCantidad === "Listo" && <CheckCircle2 className="size-4" aria-hidden="true" />}{estadoCantidad}</span> : <PreparationStatusBadge estado={pedido.preparacionEstado} />}</div>
            <ActionLink href={ROUTES.adminOrder(pedido.id)} variant="quiet" aria-label={`Ver detalle completo del pedido ${pedido.numeroPedido}`}>Ver detalle completo</ActionLink></> : null}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">{rutaMultiple ? <ActionLink href={ROUTES.adminOrder(pedido.id)} variant="secondary">Ver pedido</ActionLink> : null}<ActionLink href={`/admin/pedidos/${pedido.id}/historial`} variant="secondary">Ver historial</ActionLink></div>

          {!operativa && telefonoEntrega ? <div className="mt-3 border-t border-border pt-3"><DeliveryContactActions telefono={telefonoEntrega} numeroPedido={pedido.numeroPedido} estado={pedido.estado} nombreEmisor={nombreEmisor} /></div> : null}

          {!soloLecturaRuta && (requierePreparacion || pendienteDeConfirmacion || listoParaDespacho) ? (
            <div className="mt-4 border-t border-border pt-3">
              <p className="mb-3 text-sm text-muted-foreground">{permisoPreparacion.mensaje}</p>
              {pedido.estado === "confirmado" && !compacta ? <OrderOperationalAction pedidoId={pedido.id} estado={pedido.estado} contexto="preparacion" preparacionEstado={pedido.preparacionEstado} preparacionPermitida={permisoPreparacion.permitida} /> : null}
              {(pedido.estado === "preparando" || (!rutaMultiple && pedido.estado === "listo_despacho" && pedido.items.some(i => i.cantidadPreparada !== i.cantidad))) && permisoPreparacion.permitida ? <FinalizePreparationAction reautorizar={pedido.estado === "listo_despacho"} key={pedido.versionPreparacion} pedidoId={pedido.id} numeroPedido={pedido.numeroPedido} version={pedido.versionPreparacion} pendientes={pedido.items.length === 0 || pedido.items.every(i => i.cantidadPreparada === 0) ? Math.max(1, pedido.items.length) : pedido.items.filter((item) => !item.confirmadoExplicito || item.cantidadPreparada === null || item.importeOperativo === null).length} lineasConFaltantes={pedido.items.filter((item) => item.cantidadPreparada !== null && item.cantidadPreparada !== item.cantidad).length} /> : null}
              {permisoPreparacion.permitida && ["preparando", "listo_despacho"].includes(pedido.estado) && pedido.items.length > 0 && pedido.items.every(i => i.confirmadoExplicito && i.cantidadPreparada === 0 && i.importeOperativo === 0) ? <SinStockAction key={pedido.versionPreparacion} pedidoId={pedido.id} version={pedido.versionPreparacion} /> : null}
              {pedido.estado === "preparando" && pedido.items.length > 0 && pedido.items.every(i => i.cantidadPreparada === 0) ? <p className="mt-2 rounded-lg bg-muted p-3 text-sm">Sin unidades preparadas. Confirma cantidad e importe cero en cada producto y luego resuelve expresamente la falta total de stock.</p> : null}
              {pedido.estado === "preparando" ? <p className="mt-2 text-sm text-muted-foreground">{pedido.items.filter((item) => !item.confirmadoExplicito).length} productos pendientes de confirmación explícita.</p> : null}
              {pendienteDeConfirmacion ? <p className="text-sm text-muted-foreground">Pendiente de confirmación</p> : null}
              {listoParaDespacho && (!rutaMultiple || estadoCantidad === "Listo") ? (
                <p className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary/10 px-3 text-sm font-semibold text-primary">
                  <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
                  Listo para despacho
                </p>
              ) : null}
            </div>
          ) : null}

          {operativa && !compacta ? <div className="mt-3 space-y-1 text-sm"><p>{pedido.items.filter((item) => item.confirmadoExplicito).length} de {pedido.items.length} productos confirmados</p><progress className="h-2 w-full accent-primary" aria-label={`Preparación de ${pedido.numeroPedido}`} max={Math.max(pedido.items.length, 1)} value={pedido.items.filter((item) => item.confirmadoExplicito).length} /></div> : null}
          {!compacta && pedido.importeOperativoPreparacion !== null ? <p className="mt-3 text-sm">Importe operativo provisional: {pedido.importeOperativoPreparacion !== null && pedido.importeOperativoPreparacion !== pedido.total ? <><s>{formatCLP(pedido.total)}</s>{" → "}</> : null}{formatCLP(pedido.importeOperativoPreparacion ?? pedido.totalFinal ?? pedido.total)}</p> : null}
          {!compacta && pedido.historialPreparacion.length > 0 ? <details className="mt-3 text-sm"><summary>Historial de preparación ({pedido.historialPreparacion.length})</summary><ol className="space-y-3 pt-3">{pedido.historialPreparacion.map((revision) => <li key={revision.version} className="break-words rounded border p-2"><p>Revisión {revision.version} · {formatDateTimeCL(revision.fecha)} · Responsable: {revision.actorNombre ?? "Responsable sin nombre disponible"}</p><p>Producto: {pedido.items.find((item) => item.id === revision.item_pedido_id)?.nombreProducto ?? "Cierre del pedido"}</p><p>{revision.motivo}</p><p>Anterior: {valoresRevision(revision.valores_anteriores)}</p><p>Nuevo: {valoresRevision(revision.valores_nuevos)}</p></li>)}</ol></details> : null}
          <ContenedorProductos className="group mt-4 border-t border-border pt-3">
            {!compacta ? <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-2 text-sm font-semibold text-primary outline-none transition-colors hover:bg-muted hover:text-primary/75 focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
              <span className="group-open:hidden">Ver productos</span>
              <span className="hidden group-open:inline">Ocultar productos</span>
              <ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden="true" />
            </summary> : null}
            <div className="mt-3 min-w-0 rounded-lg bg-muted/50 p-3">
              <h4 className="text-sm font-semibold text-foreground">Productos</h4>
              {pedido.items.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">No hay productos registrados en este pedido.</p> : (
                <ul className="mt-2 divide-y divide-border">
                  {pedido.items.map((item) => (pedido.estado === "preparando" || (compacta && pedido.estado === "confirmado")) && permisoPreparacion.permitida && !soloLecturaRuta ? (
                    <li key={`${item.id}-${pedido.versionPreparacion}`} className="list-none"><ul><ControlProducto item={item} version={pedido.versionPreparacion} /></ul>{rutaMultiple && pedido.estado === "preparando" ? <details open={!item.confirmadoExplicito} className="pb-3"><summary className="min-h-11 cursor-pointer py-2 text-sm">{item.confirmadoExplicito ? "Revisar" : "Confirmar"} cantidad e importe de {item.nombreProducto}</summary><ul><PreparationItemControl item={item} version={pedido.versionPreparacion} /></ul></details> : null}</li>
                  ) : (
                    <PreparationItemControl key={item.id} item={item} version={pedido.versionPreparacion} soloLectura />
                  ))}
                </ul>
              )}
            </div>
          </ContenedorProductos>
        </div>
      </Contenedor>
    </li>
  );
}
