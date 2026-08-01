import { ORDER_STATUS_PRESENTATION } from "@/lib/orders";
import type { OrderStatus } from "@/types/account";

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const presentation = ORDER_STATUS_PRESENTATION[status];

  return (
    <span className={`inline-flex min-h-7 items-center rounded-full px-2.5 text-xs font-semibold ${presentation.className}`}>
      {presentation.label}
    </span>
  );
}
