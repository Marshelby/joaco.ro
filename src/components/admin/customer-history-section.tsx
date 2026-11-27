"use client";

import { Accordion } from "@base-ui/react/accordion";
import { ArrowLeftRight, ChevronDown, Package, ReceiptText, SlidersHorizontal, Wallet } from "lucide-react";
import type { ReactNode } from "react";

const sections = {
  movimientos: { title: "Movimientos", icon: ArrowLeftRight },
  pagos: { title: "Pagos", icon: ReceiptText },
  pedidos: { title: "Pedidos", icon: Package },
  registrarPago: { title: "Registrar pago", icon: Wallet },
  registrarAjuste: { title: "Registrar ajuste", icon: SlidersHorizontal },
};

type CustomerHistorySectionProps = {
  section: keyof typeof sections;
  count?: number;
  compact?: boolean;
  nested?: boolean;
  children: ReactNode;
};

export function CustomerHistorySection({ section, count, nested = false, compact = false, children }: CustomerHistorySectionProps) {
  const { title, icon: Icon } = sections[section];
  const Heading = nested ? "h3" : "h2";

  return (
    <Accordion.Root keepMounted className="rounded-2xl border border-border bg-card">
      <Accordion.Item value={section}>
        <Accordion.Header render={<Heading />}>
          <Accordion.Trigger className={`group flex w-full cursor-pointer items-center rounded-2xl px-3 text-left text-sm font-semibold text-foreground hover:bg-muted/50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring sm:px-4 ${compact ? "min-h-11 gap-2 py-1.5" : "min-h-12 gap-3 py-2"}`}>
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon className="size-4" aria-hidden="true" />
            </span>
            <span>{title}</span>
            {count !== undefined && (compact ? (
              <span className="text-xs font-medium tabular-nums text-muted-foreground">({count})</span>
            ) : (
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
                {count}<span className="sr-only"> {count === 1 ? "registro" : "registros"}</span>
              </span>
            ))}
            <ChevronDown className="ml-auto size-4 shrink-0 text-muted-foreground group-data-panel-open:rotate-180 motion-safe:transition-transform motion-safe:duration-150" aria-hidden="true" />
          </Accordion.Trigger>
        </Accordion.Header>
        <Accordion.Panel className={compact
          ? "overflow-hidden motion-safe:h-(--accordion-panel-height) motion-safe:transition-[height,opacity] motion-safe:duration-200 motion-safe:ease-out motion-safe:data-starting-style:h-0 motion-safe:data-starting-style:opacity-0 motion-safe:data-ending-style:h-0 motion-safe:data-ending-style:opacity-0"
          : "motion-safe:transition-opacity motion-safe:duration-150 motion-safe:data-starting-style:opacity-0"}>
          <div className={`space-y-3 border-t border-border px-3 sm:px-4 ${compact ? "py-2.5" : "py-4"}`}>{children}</div>
        </Accordion.Panel>
      </Accordion.Item>
    </Accordion.Root>
  );
}
