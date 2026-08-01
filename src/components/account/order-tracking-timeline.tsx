import { Check, Circle } from "lucide-react";

import { formatDateTimeCL } from "@/lib/formatters";
import type { CustomerOrderMock, OrderStatus } from "@/types/account";

type TrackingStep = { status: OrderStatus; label: string };

const deliverySteps: readonly TrackingStep[] = [
  { status: "pending", label: "Pedido recibido" },
  { status: "confirmed", label: "Confirmado" },
  { status: "preparing", label: "Preparando" },
  { status: "out_for_delivery", label: "En reparto" },
  { status: "delivered", label: "Entregado" },
];

const pickupSteps: readonly TrackingStep[] = [
  { status: "pending", label: "Pedido recibido" },
  { status: "confirmed", label: "Confirmado" },
  { status: "preparing", label: "Preparando" },
  { status: "ready", label: "Listo para retirar" },
  { status: "delivered", label: "Retirado" },
];

export function OrderTrackingTimeline({ order }: { order: CustomerOrderMock }) {
  const isCancelled = order.status === "cancelled";
  const completedStatuses = new Set(order.statusHistory.map((item) => item.status));
  const flow = order.deliveryMethod === "delivery" ? deliverySteps : pickupSteps;
  const currentIndex = flow.findIndex((step) => step.status === order.status);
  const steps = isCancelled
    ? [...flow.filter((step) => completedStatuses.has(step.status)), { status: "cancelled" as const, label: "Pedido cancelado" }]
    : flow;

  return (
    <ol className="space-y-4" aria-label="Progreso del pedido">
      {steps.map((step, index) => {
        const state = isCancelled
          ? step.status === "cancelled" ? "current" : "completed"
          : index < currentIndex ? "completed" : index === currentIndex ? "current" : "pending";
        const event = order.statusHistory.find((item) => item.status === step.status);

        return (
          <li key={step.status} className="flex items-center gap-3">
            <span className={`flex size-6 shrink-0 items-center justify-center rounded-full border ${state === "completed" ? "border-primary bg-primary text-primary-foreground" : state === "current" ? "border-accent bg-accent/15 text-foreground" : "border-border bg-background text-muted-foreground"}`}>
              {state === "completed" ? <Check className="size-3.5" aria-hidden="true" /> : <Circle className="size-3.5" aria-hidden="true" />}
            </span>
            <div>
              <p className={state === "pending" ? "text-sm text-muted-foreground" : "text-sm font-medium text-foreground"}>{step.label}</p>
              {event ? <p className="mt-0.5 text-xs text-muted-foreground">{formatDateTimeCL(event.occurredAt)}</p> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
