import { CalendarDays, Package, Truck } from "lucide-react";

import { CustomerOrderStatusBadge } from "@/components/account/customer-order-status-badge";
import { PreparationStatusBadge } from "@/components/order/preparation-status-badge";
import { OrderRepeatAction } from "@/components/account/order-repeat-action";
import { OrderDetailDialog } from "@/components/account/order-detail-dialog";
import { formatCLP, formatDateCL } from "@/lib/formatters";
import { formatFechaEntregaCorta } from "@/lib/delivery-date";
import type { PedidoCuentaListado } from "@/lib/account/pedidos";

export function OrderHistoryCard({ order }: { order: PedidoCuentaListado }) {
  return (
    <article id={`pedido-${order.id}`} className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/70 bg-primary/[0.03] px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <h2 className="break-words text-lg font-semibold tracking-tight text-foreground">{order.numeroPedido}</h2>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground"><CalendarDays className="size-3.5 shrink-0" aria-hidden="true" />{formatDateCL(order.fechaCreacion)}</p>
        </div>
        <div className="flex items-start gap-1">
          <div className="flex flex-wrap gap-1.5"><CustomerOrderStatusBadge estado={order.estado} />{order.preparacionEstado === "incompleta" ? <PreparationStatusBadge estado={order.preparacionEstado} /> : null}</div>
          <OrderRepeatAction pedidoId={order.id} numeroPedido={order.numeroPedido} estado={order.estado} />
        </div>
      </div>
      <div className="grid gap-4 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-5">
        <div className="min-w-0 space-y-2">
          <div className="flex items-start gap-2.5">
            <Package className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            <div className="min-w-0"><p className="text-sm font-medium text-foreground">{order.cantidadLineas} {order.cantidadLineas === 1 ? "producto" : "productos"}</p><p className="mt-0.5 line-clamp-2 break-words text-sm leading-5 text-muted-foreground">{order.resumenProductos.join(" · ") || "Sin productos registrados"}{order.cantidadLineas > 3 ? ` · +${order.cantidadLineas - 3} más` : ""}</p></div>
          </div>
          <p className="flex items-center gap-2.5 text-xs text-muted-foreground"><Truck className="size-4 shrink-0 text-primary" aria-hidden="true" />{order.fechaEntrega ? `Entrega: ${formatFechaEntregaCorta(order.fechaEntrega)}` : "Entrega por programar"}</p>
        </div>
        <div className="flex items-center justify-between gap-4 border-t border-border/70 pt-3 sm:gap-6 sm:border-0 sm:pt-0">
          <div className="sm:text-right"><p className="text-xs text-muted-foreground">Total{order.totalFinal !== null ? " final" : ""}</p><p className="mt-0.5 text-xl font-semibold tracking-tight text-foreground tabular-nums">{formatCLP(order.totalFinal ?? order.total)}</p></div>
          <OrderDetailDialog pedidoId={order.id} numeroPedido={order.numeroPedido} />
        </div>
      </div>
    </article>
  );
}
