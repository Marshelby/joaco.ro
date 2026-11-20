"use client";

import { Accordion } from "@base-ui/react/accordion";
import { ArrowLeftRight, ChevronDown, ReceiptText } from "lucide-react";
import type { ReactNode } from "react";

type CustomerHistorySectionProps = {
  section: "movimientos" | "pagos";
  count: number;
  nested?: boolean;
  children: ReactNode;
};

export function CustomerHistorySection({ section, count, nested = false, children }: CustomerHistorySectionProps) {
  const isPayments = section === "pagos";
  const Icon = isPayments ? ReceiptText : ArrowLeftRight;
  const Heading = nested ? "h3" : "h2";

  return (
    <Accordion.Root keepMounted className="rounded-2xl border border-border bg-card">
      <Accordion.Item value={section}>
        <Accordion.Header render={<Heading />}>
          <Accordion.Trigger className="group flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-2xl px-3 py-2 text-left text-sm font-semibold text-foreground hover:bg-muted/50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring sm:px-4">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon className="size-4" aria-hidden="true" />
            </span>
            <span>{isPayments ? "Pagos" : "Movimientos"}</span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
              {count}<span className="sr-only"> {count === 1 ? "registro" : "registros"}</span>
            </span>
            <ChevronDown className="ml-auto size-4 shrink-0 text-muted-foreground group-data-panel-open:rotate-180 motion-safe:transition-transform motion-safe:duration-150" aria-hidden="true" />
          </Accordion.Trigger>
        </Accordion.Header>
        <Accordion.Panel className="motion-safe:transition-opacity motion-safe:duration-150 motion-safe:data-starting-style:opacity-0">
          <div className="space-y-3 border-t border-border px-3 py-4 sm:px-4">{children}</div>
        </Accordion.Panel>
      </Accordion.Item>
    </Accordion.Root>
  );
}
