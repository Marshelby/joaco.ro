import { ArrowLeft, CreditCard, Truck } from "lucide-react";
import Link from "next/link";

import { ROUTES } from "@/config/routes";
import { formatCLP, formatDateCL, formatDateTimeCL } from "@/lib/formatters";
import { getOrderStatusDescription } from "@/lib/orders";
import type { CustomerOrderMock } from "@/types/account";

import { OrderItemRow } from "./order-item-row";
import { OrderStatusBadge } from "./order-status-badge";
import { OrderTrackingTimeline } from "./order-tracking-timeline";

const deliveryLabels = { delivery: "Delivery", pickup: "Retiro" } as const;
const paymentMethodLabels = { bank_transfer: "Transferencia bancaria", cash: "Efectivo" } as const;
const paymentStatusLabels = { pending: "Pendiente", under_review: "En revisión", paid: "Pagado" } as const;

export function OrderDetail({ order }: { order: CustomerOrderMock }) {
  const isDelivery = order.deliveryMethod === "delivery";
  const deliveryDetails = order.deliveryDetails;

  return (
    <div className="space-y-8">
      <header className="border-b border-border pb-6">
        <Link href={ROUTES.accountOrders} className="inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-semibold text-primary outline-none transition-colors hover:text-primary/75 focus-visible:ring-3 focus-visible:ring-ring/50">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Volver a Mis pedidos
        </Link>
        <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Pedido #{order.number}</h1>
            <p className="mt-2 text-sm text-muted-foreground">Realizado el {formatDateCL(order.createdAt)}</p>
            <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">{getOrderStatusDescription(order.status)}</p>
          </div>
          <OrderStatusBadge status={order.status} />
        </div>
      </header>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-start">
        <div className="space-y-8">
          <section aria-labelledby="order-products-title" className="rounded-xl border border-border bg-card p-5 sm:p-6">
            <h2 id="order-products-title" className="text-lg font-semibold tracking-tight text-foreground">Productos</h2>
            <ul className="mt-5 divide-y divide-border">
              {order.items.map((item) => <OrderItemRow key={`${item.productId}-${item.productName}`} item={item} />)}
            </ul>
          </section>

          <section aria-labelledby="tracking-title" className="border-t border-border pt-6 sm:pt-8">
            <h2 id="tracking-title" className="text-lg font-semibold tracking-tight text-foreground">Seguimiento del pedido</h2>
            <div className="mt-5"><OrderTrackingTimeline order={order} /></div>
          </section>

          <section aria-labelledby="history-title" className="border-t border-border pt-6 sm:pt-8">
            <h2 id="history-title" className="text-lg font-semibold tracking-tight text-foreground">Historial</h2>
            <ol className="mt-5 space-y-4">
              {order.statusHistory.map((item) => (
                <li key={`${item.status}-${item.occurredAt}`} className="border-l border-border pl-4">
                  <p className="text-sm font-medium text-foreground">{item.label}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{formatDateTimeCL(item.occurredAt)}</p>
                  {item.description ? <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description}</p> : null}
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside className="space-y-5">
          <section aria-label="Resumen del pedido" className="rounded-xl border border-border bg-card p-5">
            <dl className="grid gap-4 text-sm sm:grid-cols-2 xl:grid-cols-1">
              <div><dt className="text-muted-foreground">Estado</dt><dd className="mt-1"><OrderStatusBadge status={order.status} /></dd></div>
              <div><dt className="text-muted-foreground">Entrega</dt><dd className="mt-1 font-medium text-foreground">{deliveryLabels[order.deliveryMethod]}</dd></div>
              <div><dt className="text-muted-foreground">Pago</dt><dd className="mt-1 font-medium text-foreground">{paymentMethodLabels[order.paymentMethod]} · {paymentStatusLabels[order.paymentStatus]}</dd></div>
              <div><dt className="text-muted-foreground">Total</dt><dd className="mt-1 text-lg font-semibold text-foreground">{formatCLP(order.total)}</dd></div>
            </dl>
          </section>

          <section aria-labelledby="costs-title" className="rounded-xl border border-border bg-card p-5">
            <h2 id="costs-title" className="text-base font-semibold text-foreground">Resumen de costos</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between gap-4"><dt className="text-muted-foreground">Subtotal</dt><dd className="font-medium text-foreground">{formatCLP(order.subtotal)}</dd></div>
              <div className="flex items-center justify-between gap-4"><dt className="text-muted-foreground">Delivery</dt><dd className="font-medium text-foreground">{order.deliveryFee > 0 ? formatCLP(order.deliveryFee) : "Sin costo"}</dd></div>
              <div className="flex items-center justify-between gap-4 border-t border-border pt-3"><dt className="font-semibold text-foreground">Total</dt><dd className="text-base font-semibold text-foreground">{formatCLP(order.total)}</dd></div>
            </dl>
          </section>

          <section aria-labelledby="delivery-title" className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 text-muted-foreground"><Truck className="size-4" aria-hidden="true" /><p className="text-sm font-medium">Entrega</p></div>
            <h2 id="delivery-title" className="mt-3 text-base font-semibold text-foreground">{deliveryLabels[order.deliveryMethod]}</h2>
            {isDelivery && "address" in deliveryDetails ? (
              <div className="mt-3 space-y-4 text-sm">
                <p className="leading-6 text-foreground">{deliveryDetails.address}<br />{deliveryDetails.commune}, {deliveryDetails.region}</p>
                <p className="text-muted-foreground">{deliveryDetails.addressType}</p>
                <div><p className="text-muted-foreground">Recibe</p><p className="mt-1 font-medium text-foreground">{deliveryDetails.recipientName}<br />{deliveryDetails.recipientPhone}</p></div>
              </div>
            ) : "pickupLocation" in deliveryDetails ? (
              <div className="mt-3 space-y-3 text-sm"><p className="font-medium text-foreground">{deliveryDetails.pickupLocation}</p><p className="text-muted-foreground">{deliveryDetails.commune}</p>{deliveryDetails.instructions ? <p className="leading-6 text-muted-foreground">{deliveryDetails.instructions}</p> : null}</div>
            ) : null}
          </section>

          <section aria-labelledby="payment-title" className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 text-muted-foreground"><CreditCard className="size-4" aria-hidden="true" /><p className="text-sm font-medium">Pago</p></div>
            <h2 id="payment-title" className="mt-3 text-base font-semibold text-foreground">{paymentMethodLabels[order.paymentMethod]}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{paymentStatusLabels[order.paymentStatus]}</p>
            <p className="mt-3 text-base font-semibold text-foreground">{formatCLP(order.total)}</p>
          </section>
        </aside>
      </div>
    </div>
  );
}
