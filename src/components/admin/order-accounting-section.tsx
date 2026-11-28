"use client";

import { Accordion } from "@base-ui/react/accordion";
import { Calculator, ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

export function OrderAccountingSection({ children }: { children: ReactNode }) {
  return (
    <Accordion.Root keepMounted className="min-w-0 rounded-xl border border-border bg-card">
      <Accordion.Item value="resumen-contable">
        <Accordion.Header render={<h2 />}>
          <Accordion.Trigger className="group flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-xl px-3 py-1.5 text-left text-sm font-semibold tracking-tight text-foreground hover:bg-muted/50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Calculator className="size-4" aria-hidden="true" />
            </span>
            <span>Resumen contable de la entrega</span>
            <ChevronDown className="ml-auto size-4 shrink-0 text-muted-foreground group-data-panel-open:rotate-180 motion-safe:transition-transform motion-safe:duration-150" aria-hidden="true" />
          </Accordion.Trigger>
        </Accordion.Header>
        <Accordion.Panel className="overflow-hidden motion-safe:h-(--accordion-panel-height) motion-safe:transition-[height,opacity] motion-safe:duration-200 motion-safe:ease-out motion-safe:data-starting-style:h-0 motion-safe:data-starting-style:opacity-0 motion-safe:data-ending-style:h-0 motion-safe:data-ending-style:opacity-0">
          <div className="border-t border-border px-3 pb-3">{children}</div>
        </Accordion.Panel>
      </Accordion.Item>
    </Accordion.Root>
  );
}
