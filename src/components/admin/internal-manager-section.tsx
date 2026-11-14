"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

export function InternalManagerSection({ id, title, description, defaultOpen = false, children }: {
  id: string;
  title: string;
  description: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section id={id} className="min-w-0 scroll-mt-4 overflow-hidden rounded-xl border border-border bg-card" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`}>
        <button type="button" aria-expanded={open} aria-controls={`${id}-content`} onClick={() => setOpen(!open)} className="flex min-h-14 w-full items-center gap-3 p-4 text-left outline-none transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50 sm:px-5">
          <span className="min-w-0 flex-1">
            <span className="block text-base font-semibold text-foreground">{title}</span>
            <span className="mt-1 block text-sm font-normal text-muted-foreground">{description}</span>
          </span>
          <ChevronDown aria-hidden="true" className={`size-5 shrink-0 text-primary transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </h2>
      {/* Mantener el contenido montado conserva formularios y estados al cerrar. */}
      <div id={`${id}-content`} role="region" aria-labelledby={`${id}-title`} hidden={!open} className="border-t border-border p-4 sm:p-5">
        {children}
      </div>
    </section>
  );
}
