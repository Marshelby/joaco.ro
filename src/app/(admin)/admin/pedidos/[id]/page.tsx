import { UndeliveredOrderActions } from "@/components/admin/undelivered-order-actions";
import { AdministrativeCorrection } from "@/components/admin/administrative-correction";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { OrderAcceptAction } from "@/components/admin/order-accept-action";
import { OrderCancelAction } from "@/components/admin/order-cancel-action";
import { DeliveryContactActions } from "@/components/admin/delivery-contact-actions";
import { OrderOperationalAction } from "@/components/admin/order-operational-action";
import { OrderStatusBadge } from "@/components/admin/order-status-badge";
import { CatalogImage } from "@/components/media/catalog-image";
import { OrderIdentity } from "@/components/admin/order-identity";
import { ActionLink } from "@/components/ui/action-link";
import { ROUTES } from "@/config/routes";
import { formatearCantidadPedido, obtenerEtiquetaCanalPedido, obtenerPedidoAdmin } from "@/lib/admin/pedidos";
import { formatFechaEntregaLarga } from "@/lib/delivery-date";
import { formatCLP, formatDateTimeCL } from "@/lib/formatters";
import { getGoogleMapsLocationUrl } from "@/lib/maps";
import { formatearMetodosPagoPrevistos } from "@/lib/payment-intent";
import { obtenerIdentidadActual } from "@/lib/account/identity";
import { obtenerPermisoTemporalPreparacion } from "@/lib/order-preparation";
import { ExternalLink } from "lucide-react";

export const metadata: Metadata = { title: "Detalle de pedido" };

export default async function AdminOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [pedido, identidad] = await Promise.all([obtenerPedidoAdmin(id), obtenerIdentidadActual()]);
  if (!pedido) notFound();

  const permisoPreparacion = obtenerPermisoTemporalPreparacion(pedido.fechaEntrega);
  const direccion = [pedido.direccionSnapshot, pedido.comunaSnapshot, pedido.regionSnapshot].filter(Boolean).join(", ");
  const mapsUrl = getGoogleMapsLocationUrl(pedido.latitudEntrega, pedido.longitudEntrega);
  const pagoPrevisto = formatearMetodosPagoPrevistos(pedido.metodosPagoPrevistos) ?? "No registrado";
  const telefonoEntrega = pedido.telefonoContactoEntrega ?? pedido.telefonoClienteSnapshot;
  const nombreEmisor = identidad?.rol === "admin" && identidad.nombreMostrado.trim() !== identidad.email ? identidad.nombreMostrado : null;

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-5 border-b border-border pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-3">
          <OrderIdentity pedido={pedido} heading="h1" />
          <p className="text-sm leading-6 text-muted-foreground">Creado el {formatDateTimeCL(pedido.fechaCreacion)} · Canal {obtenerEtiquetaCanalPedido(pedido.canalOrigen)}</p>
        </div>
        <ActionLink href={ROUTES.adminOrders} variant="secondary" className="shrink-0">Volver a pedidos</ActionLink>
      </header>
      <div className="flex flex-wrap items-start gap-3">
        <ActionLink href={`/admin/pedidos/${pedido.id}/historial`} variant="secondary">Ver historial</ActionLink>
        {pedido.estado === "recibido" ? <OrderAcceptAction pedidoId={pedido.id} /> : null}
        {["confirmado", "preparando", "listo_despacho", "en_reparto"].includes(pedido.estado) ? <OrderOperationalAction pedidoId={pedido.id} estado={pedido.estado} preparacionEstado={pedido.preparacionEstado} preparacionPermitida={permisoPreparacion.permitida} /> : null}
        {["recibido", "en_revision", "confirmado", "programado", "preparando"].includes(pedido.estado) ? <OrderCancelAction pedidoId={pedido.id} /> : null}
      </div>

      {pedido.estado === "entrega_fallida" ? <UndeliveredOrderActions pedidoId={pedido.id} /> : null}
      {pedido.estado === "cancelado" ? <p className="text-sm text-muted-foreground">Pedido cancelado. Consulta el historial para revisar el motivo y el tratamiento de pagos y créditos; la cancelación no realiza devoluciones automáticas.</p> : null}

      {pedido.estado === "entregado" ? <AdministrativeCorrection tipo="venta" id={pedido.id} /> : null}

      <p className="text-sm text-muted-foreground">{permisoPreparacion.mensaje}</p>
      {pedido.estado === "preparando" && pedido.fechaEntrega ? <ActionLink href={`/admin/pedidos/entregas/${pedido.fechaEntrega}`} variant="secondary">Ver preparación en la jornada</ActionLink> : null}

      <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">Estado</h2>
        <div className="mt-4"><OrderStatusBadge estado={pedido.estado} /></div>
      </section>

      <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">Cliente titular</h2>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
          <div><dt className="text-muted-foreground">Nombre</dt><dd className="mt-1 font-medium text-foreground">{pedido.nombreClienteSnapshot}</dd></div>
          {pedido.telefonoClienteSnapshot ? <div><dt className="text-muted-foreground">Teléfono</dt><dd className="mt-1 text-foreground">{pedido.telefonoClienteSnapshot}</dd></div> : null}
          {pedido.emailClienteSnapshot ? <div><dt className="text-muted-foreground">Email</dt><dd className="mt-1 break-words text-foreground">{pedido.emailClienteSnapshot}</dd></div> : null}
        </dl>
        {pedido.clienteId ? <ActionLink href={`${ROUTES.adminCustomer(pedido.clienteId)}#cuenta-corriente-title`} variant="quiet" className="mt-3">Consultar cuenta corriente</ActionLink> : <p className="mt-3 text-sm text-muted-foreground">Sin cliente asociado para consultar cuenta corriente.</p>}
      </section>

      <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">Entrega</h2>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div><dt className="text-muted-foreground">Fecha de entrega</dt><dd className="mt-1 font-medium text-foreground">{pedido.fechaEntrega ? formatFechaEntregaLarga(pedido.fechaEntrega) : "Sin fecha registrada"}</dd></div>
          {pedido.destinatarioEntrega ? <div><dt className="text-muted-foreground">Destinatario</dt><dd className="mt-1 font-medium text-foreground">{pedido.destinatarioEntrega}</dd></div> : null}
          {telefonoEntrega ? <div><dt className="text-muted-foreground">Teléfono</dt><dd className="mt-1"><DeliveryContactActions telefono={telefonoEntrega} numeroPedido={pedido.numeroPedido} estado={pedido.estado} nombreEmisor={nombreEmisor} /></dd></div> : null}
          <div className="sm:col-span-2"><dt className="text-muted-foreground">Dirección de entrega</dt><dd className="mt-1 leading-6 text-foreground">{direccion || "No registrada"}</dd></div>
          {pedido.zonaEntrega ? <div><dt className="text-muted-foreground">Zona</dt><dd className="mt-1 text-foreground">{pedido.zonaEntrega}</dd></div> : null}
          {pedido.referenciaDireccionSnapshot ? <div className="sm:col-span-2"><dt className="text-muted-foreground">Referencia</dt><dd className="mt-1 leading-6 text-muted-foreground">{pedido.referenciaDireccionSnapshot}</dd></div> : null}
        </dl>
        {mapsUrl ? <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-semibold text-primary underline underline-offset-4"><ExternalLink className="size-4" aria-hidden="true" />Ver ubicación</a> : null}
      </section>

      <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">Resumen</h2>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          {pedido.preparacionEstado ? <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Preparación</dt><dd className="font-medium text-foreground">{pedido.preparacionEstado === "incompleta" ? "Incompleta" : pedido.preparacionEstado === "completa" ? "Completa" : "Pendiente"}</dd></div> : null}
          <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Subtotal</dt><dd>{formatCLP(pedido.subtotal)}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Costo entrega</dt><dd>{formatCLP(pedido.costoEntrega)}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Descuento</dt><dd>{formatCLP(pedido.descuento)}</dd></div>
          <div className="flex justify-between gap-3 sm:col-span-2"><dt className="text-muted-foreground">Pago previsto</dt><dd className="text-right font-medium text-foreground">{pagoPrevisto}</dd></div>
          <div className="flex justify-between gap-3 border-t border-border pt-3"><dt className="text-muted-foreground">Total original</dt><dd>{formatCLP(pedido.total)}</dd></div>
          {pedido.subtotalFinal !== null ? <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Subtotal final</dt><dd>{formatCLP(pedido.subtotalFinal)}</dd></div> : null}
          {pedido.totalFinal !== null ? <div className="flex justify-between gap-3 text-base font-semibold text-foreground"><dt>Total final</dt><dd>{formatCLP(pedido.totalFinal)}</dd></div> : null}
        </dl>
        <p className="mt-4 text-sm text-muted-foreground">Los métodos de pago previstos no acreditan pagos.</p>
      </section>

      <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">Productos</h2>
        {pedido.items.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">No hay productos registrados.</p> : null}
        <ul className="mt-4 divide-y divide-border">
          {pedido.items.map((item) => <li key={item.id} className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_8rem_8rem] sm:items-center">
            <div className="flex min-w-0 items-center gap-3">
              <div className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-muted sm:size-14">
                <CatalogImage image={item.rutaImagen ? { src: item.rutaImagen, alt: "", fit: "contain" } : undefined} fallback="package" sizes="(min-width: 640px) 56px, 48px" fallbackIconClassName="size-6" />
              </div>
              <div className="min-w-0"><h3 className="font-medium text-foreground">{item.nombreProductoSnapshot}</h3><p className="mt-1 text-sm text-muted-foreground">{item.nombrePresentacionSnapshot ?? "Presentación no registrada"}</p></div>
            </div>
            <dl className="grid grid-cols-2 gap-3 text-sm sm:block"><div><dt className="text-muted-foreground">Cantidad</dt><dd className="mt-1 font-medium text-foreground">{formatearCantidadPedido(item.cantidad, item.unidadSnapshot)}</dd></div><div className="sm:mt-2"><dt className="text-muted-foreground">Precio unitario snapshot</dt><dd className="mt-1 font-medium text-foreground">{formatCLP(item.precioFinalUnitarioSnapshot)}</dd></div></dl>
            <p className="text-right font-semibold text-foreground">{formatCLP(item.totalLinea)}</p>
          </li>)}
        </ul>
      </section>

      <section className="rounded-xl border border-border bg-card p-4 sm:p-5" aria-labelledby="historial-precios-title">
        <h2 id="historial-precios-title" className="text-lg font-semibold tracking-tight text-foreground">Historial de ajustes de precios administrativos</h2>
        <p className="mt-2 text-sm text-muted-foreground">Ajustes registrados al crear el pedido administrativo.</p>
        {pedido.historialPrecios === null ? <p className="mt-4 text-sm text-muted-foreground">El historial de ajustes administrativos todavía no está disponible en este entorno.</p> : pedido.historialPrecios.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">Sin ajustes de precios administrativos registrados para este pedido. Los pedidos históricos, web o convertidos pueden no tener registros en esta auditoría.</p> : (
          <ul className="mt-4 divide-y divide-border">
            {pedido.historialPrecios.map((ajuste) => {
              const item = pedido.items.find((producto) => producto.id === ajuste.itemPedidoId);
              return <li key={ajuste.itemPedidoId} className="space-y-3 py-4">
                <h3 className="font-medium text-foreground">{item ? [item.nombreProductoSnapshot, item.nombrePresentacionSnapshot].filter(Boolean).join(" · ") : "Producto no disponible"}</h3>
                <dl className="grid gap-3 text-sm sm:grid-cols-2">
                  <div><dt className="text-muted-foreground">{ajuste.totalOriginal === null ? "Precio de referencia unitario" : "Total original de línea"}</dt><dd className="mt-1">{formatCLP(ajuste.totalOriginal ?? ajuste.precioReferencia)}</dd></div>
                  <div><dt className="text-muted-foreground">{ajuste.totalAplicado === null ? "Precio aplicado unitario" : "Total final de línea"}</dt><dd className="mt-1">{formatCLP(ajuste.totalAplicado ?? ajuste.precioAplicado ?? 0)}</dd></div>
                  <div className="sm:col-span-2"><dt className="text-muted-foreground">Motivo</dt><dd className="mt-1 whitespace-pre-wrap break-words">{ajuste.motivo}</dd></div>
                  <div><dt className="text-muted-foreground">Actor (ID administrador)</dt><dd className="mt-1 break-all">{ajuste.administradorId}</dd></div>
                  <div><dt className="text-muted-foreground">Fecha de autorización</dt><dd className="mt-1"><time dateTime={ajuste.fechaAutorizacion}>{formatDateTimeCL(ajuste.fechaAutorizacion)}</time></dd></div>
                </dl>
              </li>;
            })}
          </ul>
        )}
      </section>

      {pedido.observacionGeneral ? <section className="rounded-xl border border-border bg-card p-4 sm:p-5"><h2 className="text-lg font-semibold tracking-tight text-foreground">Observación</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{pedido.observacionGeneral}</p></section> : null}
    </div>
  );
}
