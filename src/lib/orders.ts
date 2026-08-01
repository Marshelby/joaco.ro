import type { CustomerOrderMock, OrderStatus } from "@/types/account";

export const ORDER_STATUS_PRESENTATION: Record<
  OrderStatus,
  { label: string; description: string; className: string; terminal: boolean }
> = {
  pending: { label: "Pendiente de confirmación", description: "Recibimos tu pedido y estamos revisando su disponibilidad.", className: "bg-muted text-muted-foreground", terminal: false },
  confirmed: { label: "Confirmado", description: "Tu pedido fue confirmado.", className: "bg-primary/10 text-primary", terminal: false },
  preparing: { label: "Preparando", description: "Estamos preparando tu compra para la entrega o el retiro.", className: "bg-accent/15 text-foreground", terminal: false },
  ready: { label: "Listo para retirar", description: "Tu pedido está listo para retirar.", className: "bg-primary/10 text-primary", terminal: false },
  out_for_delivery: { label: "En ruta", description: "Tu pedido va en camino.", className: "bg-primary/10 text-primary", terminal: false },
  delivered: { label: "Entregado", description: "Tu pedido fue entregado.", className: "bg-secondary text-secondary-foreground", terminal: true },
  cancelled: { label: "Cancelado", description: "Este pedido fue cancelado.", className: "bg-muted text-muted-foreground", terminal: true },
};

export function sortCustomerOrdersNewestFirst(orders: readonly CustomerOrderMock[]) {
  return [...orders].sort((first, second) => second.createdAt.localeCompare(first.createdAt));
}

export function getCustomerOrderById(orders: readonly CustomerOrderMock[], id: string) {
  return orders.find((order) => order.id === id);
}

export function getOrderStatusDescription(status: OrderStatus) {
  return ORDER_STATUS_PRESENTATION[status].description;
}

export function getOrderItemCount(order: CustomerOrderMock) {
  return order.items.reduce((total, item) => total + item.quantity, 0);
}
