import { ArrowLeft, ExternalLink, MapPin } from "lucide-react";
import Link from "next/link";

import { CustomerOrderStatusBadge, getEtiquetaEstadoPedidoCuenta } from "@/components/account/customer-order-status-badge";
import { ROUTES } from "@/config/routes";
import type { PedidoCuentaDetalle } from "@/lib/account/pedidos";
import { formatCLP, formatDateCL } from "@/lib/formatters";
import { formatFechaEntregaLarga } from "@/lib/delivery-date";
import { getGoogleMapsLocationUrl } from "@/lib/maps";

import { OrderItemRow } from "./order-item-row";
import { OrderTrackingTimeline } from "./order-tracking-timeline";

export function OrderDetail({ order }: { order: PedidoCuentaDetalle }) {
  const direccion = [order.direccionSnapshot, order.comunaSnapshot, order.regionSnapshot].filter(Boolean).join(", ");
  const mapsUrl = getGoogleMapsLocationUrl(order.latitudEntrega, order.longitudEntrega);

  return (
    <div className="space-y-8">
      <header className="border-b border-border pb-6">
        <Link href={ROUTES.accountOrders} className="inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-semibold text-primary outline-none transition-colors hover:text-primary/75 focus-visible:ring-3 focus-visible:ring-ring/50">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Volver a Mis pedidos
        </Link>
        <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{order.numeroPedido}</h1>
            <p className="mt-2 text-sm text-muted-foreground">Realizado el {formatDateCL(order.fechaCreacion)}</p>
          </div>
          <CustomerOrderStatusBadge estado={order.estado} />
        </div>
      </header>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-start">
        <div className="space-y-8">
          <section aria-labelledby="order-products-title" className="rounded-xl border border-border bg-card p-5 sm:p-6">
            <h2 id="order-products-title" className="text-lg font-semibold tracking-tight text-foreground">Productos</h2>
            <ul className="mt-5 divide-y divide-border">
              {order.items.map((item) => <OrderItemRow key={item.id} item={item} />)}
            </ul>
          </section>

          <section aria-labelledby="history-title" className="border-t border-border pt-6 sm:pt-8">
            <h2 id="history-title" className="text-lg font-semibold tracking-tight text-foreground">Historial</h2>
            {order.historial.length > 0 ? <div className="mt-5"><OrderTrackingTimeline historial={order.historial} /></div> : <p className="mt-3 text-sm text-muted-foreground">Este pedido aún no registra cambios de estado.</p>}
          </section>
        </div>

        <aside className="space-y-5">
          <section aria-label="Resumen del pedido" className="rounded-xl border border-border bg-card p-5">
            <dl className="grid gap-4 text-sm sm:grid-cols-2 xl:grid-cols-1">
              <div><dt className="text-muted-foreground">Total</dt><dd className="mt-1 text-lg font-semibold text-foreground">{formatCLP(order.total)}</dd></div>
              {order.fechaEntrega ? <div><dt className="text-muted-foreground">Entrega programada</dt><dd className="mt-1 font-medium text-foreground">{formatFechaEntregaLarga(order.fechaEntrega)}</dd></div> : null}
            </dl>
          </section>

          <section aria-labelledby="costs-title" className="rounded-xl border border-border bg-card p-5">
            <h2 id="costs-title" className="text-base font-semibold text-foreground">Resumen de costos</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between gap-4"><dt className="text-muted-foreground">Subtotal</dt><dd className="font-medium text-foreground">{formatCLP(order.subtotal)}</dd></div>
              <div className="flex items-center justify-between gap-4"><dt className="text-muted-foreground">Entrega</dt><dd className="font-medium text-foreground">{order.costoEntrega > 0 ? formatCLP(order.costoEntrega) : "Sin costo"}</dd></div>
              <div className="flex items-center justify-between gap-4"><dt className="text-muted-foreground">Descuento</dt><dd className="font-medium text-foreground">{order.descuento > 0 ? `-${formatCLP(order.descuento)}` : "Sin descuento"}</dd></div>
              <div className="flex items-center justify-between gap-4 border-t border-border pt-3"><dt className="font-semibold text-foreground">Total</dt><dd className="text-base font-semibold text-foreground">{formatCLP(order.total)}</dd></div>
            </dl>
          </section>

          <section aria-labelledby="order-state-title" className="rounded-xl border border-border bg-card p-5"><h2 id="order-state-title" className="text-sm font-medium text-muted-foreground">Estado</h2><p className="mt-2 text-base font-semibold text-foreground">{getEtiquetaEstadoPedidoCuenta(order.estado)}</p></section>

          {direccion || order.referenciaDireccionSnapshot || order.destinatarioEntrega ? <section aria-labelledby="delivery-title" className="rounded-xl border border-border bg-card p-5"><div className="flex items-center gap-2 text-muted-foreground"><MapPin className="size-4" aria-hidden="true" /><p className="text-sm font-medium">Entrega</p></div>{order.destinatarioEntrega ? <p id="delivery-title" className="mt-3 font-medium text-foreground">{order.destinatarioEntrega}</p> : null}{order.telefonoContactoEntrega ? <a href={`tel:${order.telefonoContactoEntrega}`} className="mt-2 inline-flex text-sm text-primary underline underline-offset-4">{order.telefonoContactoEntrega}</a> : null}{direccion ? <p className="mt-2 leading-6 text-foreground">{direccion}</p> : null}{order.zonaEntrega ? <p className="mt-1 text-sm text-muted-foreground">{order.zonaEntrega}</p> : null}{order.referenciaDireccionSnapshot ? <p className="mt-2 text-sm leading-6 text-muted-foreground">{order.referenciaDireccionSnapshot}</p> : null}{mapsUrl ? <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-semibold text-primary underline underline-offset-4"><ExternalLink className="size-4" aria-hidden="true" />Ver ubicación</a> : null}</section> : null}

          {order.observacionGeneral ? <section aria-labelledby="observation-title" className="rounded-xl border border-border bg-card p-5"><h2 id="observation-title" className="text-sm font-medium text-muted-foreground">Observación</h2><p className="mt-2 text-sm leading-6 text-foreground">{order.observacionGeneral}</p></section> : null}
        </aside>
      </div>
    </div>
  );
}
