import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { CustomerOrderStatusBadge } from "@/components/account/customer-order-status-badge";
import { PreparationStatusBadge } from "@/components/order/preparation-status-badge";
import { OrderRepeatAction } from "@/components/account/order-repeat-action";
import { ROUTES } from "@/config/routes";
import { formatCLP, formatDateCL } from "@/lib/formatters";
import { formatFechaEntregaCorta } from "@/lib/delivery-date";
import type { PedidoCuentaListado } from "@/lib/account/pedidos";

type OrderHistoryCardProps = { order: PedidoCuentaListado };

export function OrderHistoryCard({ order }: OrderHistoryCardProps) {
  const itemCount = order.cantidadLineas;

  return (
    <article id={`pedido-${order.id}`} className="rounded-xl border border-border bg-card p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold tracking-tight text-foreground">{order.numeroPedido}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{formatDateCL(order.fechaCreacion)}</p>
          {order.fechaEntrega ? <p className="mt-1 text-sm text-muted-foreground">Entrega: {formatFechaEntregaCorta(order.fechaEntrega)}</p> : null}
        </div>
        <div className="flex items-start gap-1">
          <div className="flex flex-wrap justify-end gap-1"><CustomerOrderStatusBadge estado={order.estado} />{order.preparacionEstado === "incompleta" ? <PreparationStatusBadge estado={order.preparacionEstado} /> : null}</div>
          <OrderRepeatAction pedidoId={order.id} numeroPedido={order.numeroPedido} estado={order.estado} />
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 text-sm">
        <div>
          <dt className="text-muted-foreground">Productos</dt>
          <dd className="mt-1 font-medium text-foreground">{itemCount} {itemCount === 1 ? "producto" : "productos"}</dd>
        </div>
        <div className="text-right">
          <dt className="text-muted-foreground">Total</dt>
          <dd className="mt-1 text-base font-semibold text-foreground">{formatCLP(order.totalFinal ?? order.total)}</dd>
        </div>
      </dl>

      <Link href={ROUTES.customerOrder(order.id)} className="mt-4 inline-flex min-h-11 items-center gap-1 rounded-lg text-sm font-semibold text-primary outline-none transition-colors hover:text-primary/75 focus-visible:ring-3 focus-visible:ring-ring/50" aria-label={`Ver más sobre el pedido ${order.numeroPedido}`}>
        Ver más
        <ChevronRight className="size-4" aria-hidden="true" />
      </Link>
    </article>
  );
}
