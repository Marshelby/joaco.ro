import { Truck } from "lucide-react";

import { ActionLink } from "@/components/ui/action-link";

export function DeliveryAccessCard() {
  return (
    <section aria-labelledby="mi-reparto-title" className="rounded-xl border border-primary/25 bg-card p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-3">
          <Truck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
          <div>
            <h2 id="mi-reparto-title" className="font-semibold text-foreground">Mi reparto</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">Consulta tus rutas asignadas y gestiona tus entregas.</p>
          </div>
        </div>
        <ActionLink href="/reparto" prefetch={false} className="w-full shrink-0 sm:w-auto">Ver mi reparto</ActionLink>
      </div>
    </section>
  );
}
