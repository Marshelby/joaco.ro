import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { OrderAcceptAction } from "@/components/admin/order-accept-action";
import { OrderCancelAction } from "@/components/admin/order-cancel-action";
import { DeliveryContactActions } from "@/components/admin/delivery-contact-actions";
import { OrderOperationalAction } from "@/components/admin/order-operational-action";
import { OrderStatusBadge } from "@/components/admin/order-status-badge";
import { CatalogImage } from "@/components/media/catalog-image";
import { PageHeader } from "@/components/shared/page-header";
import { ActionLink } from "@/components/ui/action-link";
import { ROUTES } from "@/config/routes";
import { formatearCantidadPedido, obtenerPedidoAdmin } from "@/lib/admin/pedidos";
import { formatFechaEntregaLarga } from "@/lib/delivery-date";
import { formatCLP, formatDateTimeCL } from "@/lib/formatters";
import { getGoogleMapsLocationUrl } from "@/lib/maps";
import { formatearMetodosPagoPrevistos } from "@/lib/payment-intent";
import { obtenerIdentidadActual } from "@/lib/account/identity";
import { ExternalLink } from "lucide-react";

export const metadata: Metadata = { title: "Detalle de pedido" };

export default async function AdminOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [pedido, identidad] = await Promise.all([obtenerPedidoAdmin(id), obtenerIdentidadActual()]);
  if (!pedido) notFound();

  const direccion = [pedido.direccionSnapshot, pedido.comunaSnapshot, pedido.regionSnapshot].filter(Boolean).join(", ");
  const mapsUrl = getGoogleMapsLocationUrl(pedido.latitudEntrega, pedido.longitudEntrega);
  const pagoPrevisto = formatearMetodosPagoPrevistos(pedido.metodosPagoPrevistos) ?? "No registrado";
  const telefonoEntrega = pedido.telefonoContactoEntrega ?? pedido.telefonoClienteSnapshot;
  const nombreEmisor = identidad?.rol === "admin" && identidad.nombreMostrado.trim() !== identidad.email ? identidad.nombreMostrado : null;

  return (
    <div className="space-y-8">
      <PageHeader title={pedido.numeroPedido} description={`Creado el ${formatDateTimeCL(pedido.fechaCreacion)} · Canal ${pedido.canalOrigen}`} actions={<ActionLink href={ROUTES.adminOrders} variant="secondary">Volver a pedidos</ActionLink>} />
      <div className="flex flex-wrap items-start gap-3">
        {pedido.estado === "recibido" ? <OrderAcceptAction pedidoId={pedido.id} /> : null}
        {["confirmado", "preparando", "listo_despacho", "en_reparto"].includes(pedido.estado) ? <OrderOperationalAction pedidoId={pedido.id} estado={pedido.estado} preparacionEstado={pedido.preparacionEstado} /> : null}
        {["recibido", "en_revision", "confirmado", "programado", "preparando"].includes(pedido.estado) ? <OrderCancelAction pedidoId={pedido.id} /> : null}
      </div>

      <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">Estado</h2>
        <div className="mt-4"><OrderStatusBadge estado={pedido.estado} /></div>
      </section>

      <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">Cliente</h2>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
          <div><dt className="text-muted-foreground">Nombre</dt><dd className="mt-1 font-medium text-foreground">{pedido.nombreClienteSnapshot}</dd></div>
          {pedido.telefonoClienteSnapshot ? <div><dt className="text-muted-foreground">Teléfono</dt><dd className="mt-1 text-foreground">{pedido.telefonoClienteSnapshot}</dd></div> : null}
          {pedido.emailClienteSnapshot ? <div><dt className="text-muted-foreground">Email</dt><dd className="mt-1 break-words text-foreground">{pedido.emailClienteSnapshot}</dd></div> : null}
        </dl>
      </section>

      {direccion || pedido.destinatarioEntrega || pedido.fechaEntrega ? <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">Entrega</h2>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          {pedido.fechaEntrega ? <div><dt className="text-muted-foreground">Fecha de entrega</dt><dd className="mt-1 font-medium text-foreground">{formatFechaEntregaLarga(pedido.fechaEntrega)}</dd></div> : null}
          {pedido.destinatarioEntrega ? <div><dt className="text-muted-foreground">Destinatario</dt><dd className="mt-1 font-medium text-foreground">{pedido.destinatarioEntrega}</dd></div> : null}
          {telefonoEntrega ? <div><dt className="text-muted-foreground">Teléfono</dt><dd className="mt-1"><DeliveryContactActions telefono={telefonoEntrega} numeroPedido={pedido.numeroPedido} estado={pedido.estado} nombreEmisor={nombreEmisor} /></dd></div> : null}
          {direccion ? <div className="sm:col-span-2"><dt className="text-muted-foreground">Dirección</dt><dd className="mt-1 leading-6 text-foreground">{direccion}</dd></div> : null}
          {pedido.zonaEntrega ? <div><dt className="text-muted-foreground">Zona</dt><dd className="mt-1 text-foreground">{pedido.zonaEntrega}</dd></div> : null}
          {pedido.referenciaDireccionSnapshot ? <div className="sm:col-span-2"><dt className="text-muted-foreground">Referencia</dt><dd className="mt-1 leading-6 text-muted-foreground">{pedido.referenciaDireccionSnapshot}</dd></div> : null}
        </dl>
        {mapsUrl ? <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-semibold text-primary underline underline-offset-4"><ExternalLink className="size-4" aria-hidden="true" />Ver ubicación</a> : null}
      </section> : null}

      <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">Resumen</h2>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          {pedido.preparacionEstado ? <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Preparación</dt><dd className="font-medium text-foreground">{pedido.preparacionEstado === "incompleta" ? "Incompleta" : pedido.preparacionEstado === "completa" ? "Completa" : "Pendiente"}</dd></div> : null}
          <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Subtotal</dt><dd>{formatCLP(pedido.subtotal)}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Costo entrega</dt><dd>{formatCLP(pedido.costoEntrega)}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Descuento</dt><dd>{formatCLP(pedido.descuento)}</dd></div>
          <div className="flex justify-between gap-3 sm:col-span-2"><dt className="text-muted-foreground">Pago previsto</dt><dd className="text-right font-medium text-foreground">{pagoPrevisto}</dd></div>
          <div className="flex justify-between gap-3 border-t border-border pt-3"><dt className="text-muted-foreground">Total original</dt><dd>{formatCLP(pedido.total)}</dd></div>
          {pedido.totalFinal !== null ? <div className="flex justify-between gap-3 text-base font-semibold text-foreground"><dt>Total final</dt><dd>{formatCLP(pedido.totalFinal)}</dd></div> : null}
        </dl>
      </section>

      <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">Productos</h2>
        <ul className="mt-4 divide-y divide-border">
          {pedido.items.map((item) => <li key={item.id} className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_8rem_8rem] sm:items-center">
            <div className="flex min-w-0 items-center gap-3">
              <div className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-muted sm:size-14">
                <CatalogImage image={item.rutaImagen ? { src: item.rutaImagen, alt: "", fit: "contain" } : undefined} fallback="package" sizes="(min-width: 640px) 56px, 48px" fallbackIconClassName="size-6" />
              </div>
              <h3 className="min-w-0 font-medium text-foreground">{item.nombreProductoSnapshot}</h3>
            </div>
            <dl className="grid grid-cols-2 gap-3 text-sm sm:block"><div><dt className="text-muted-foreground">Cantidad</dt><dd className="mt-1 font-medium text-foreground">{formatearCantidadPedido(item.cantidad, item.unidadSnapshot)}</dd></div><div className="sm:mt-2"><dt className="text-muted-foreground">Valor unitario</dt><dd className="mt-1 font-medium text-foreground">{formatCLP(item.precioFinalUnitarioSnapshot)}</dd></div></dl>
            <p className="text-right font-semibold text-foreground">{formatCLP(item.totalLinea)}</p>
          </li>)}
        </ul>
      </section>

      {pedido.observacionGeneral ? <section className="rounded-xl border border-border bg-card p-4 sm:p-5"><h2 className="text-lg font-semibold tracking-tight text-foreground">Observación</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{pedido.observacionGeneral}</p></section> : null}
    </div>
  );
}
