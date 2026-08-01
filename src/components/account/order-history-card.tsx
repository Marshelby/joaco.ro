import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { ROUTES } from "@/config/routes";
import { formatCLP, formatDateCL } from "@/lib/formatters";
import { getOrderItemCount } from "@/lib/orders";
import type { CustomerOrderMock } from "@/types/account";

import { OrderStatusBadge } from "./order-status-badge";

type OrderHistoryCardProps = { order: CustomerOrderMock };

const deliveryLabels = { delivery: "Delivery", pickup: "Retiro" } as const;

export function OrderHistoryCard({ order }: OrderHistoryCardProps) {
  const itemCount = getOrderItemCount(order);

  return (
    <Link
      href={ROUTES.customerOrder(order.id)}
      className="group block rounded-xl border border-border bg-card p-5 outline-none transition-colors hover:border-primary/30 hover:bg-muted/35 focus-visible:ring-3 focus-visible:ring-ring/50 sm:p-6"
      aria-label={`Ver pedido ${order.number}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">Pedido #{order.number}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{formatDateCL(order.createdAt)}</p>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>

      <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-[1fr_auto_auto] sm:items-end sm:gap-6">
        <div>
          <dt className="text-muted-foreground">Entrega</dt>
          <dd className="mt-1 font-medium text-foreground">{deliveryLabels[order.deliveryMethod]} · {order.deliveryDetails.commune}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Productos</dt>
          <dd className="mt-1 font-medium text-foreground">{itemCount} {itemCount === 1 ? "producto" : "productos"}</dd>
        </div>
        <div className="flex items-end justify-between gap-4 sm:justify-end">
          <div>
            <dt className="text-muted-foreground">Total</dt>
            <dd className="mt-1 text-base font-semibold text-foreground">{formatCLP(order.total)}</dd>
          </div>
          <ChevronRight className="size-5 text-muted-foreground transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true" />
        </div>
      </dl>
    </Link>
  );
}
