"use client";

import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, type ReactNode } from "react";

export function OrderDetailModal({ children }: { children: ReactNode }) {
  const router = useRouter();
  const closing = useRef(false);

  function close() {
    if (closing.current) return;
    closing.current = true;
    // Interception only happens after soft navigation: the previous entry is the
    // mounted list, including its query parameters and browser scroll position.
    router.back();
  }

  return <Dialog.Root open onOpenChange={(open) => { if (!open) close(); }}>
    <Dialog.Portal>
      <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm" />
      <Dialog.Viewport className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-5">
        <Dialog.Popup className="flex max-h-[calc(100dvh-1rem)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl outline-none sm:max-h-[calc(100dvh-2.5rem)]">
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-4 py-2 sm:px-5">
            <Dialog.Title className="text-sm font-semibold text-foreground">Detalle de pedido</Dialog.Title>
            <Dialog.Close type="button" aria-label="Cerrar detalle de pedido" className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
              <X className="size-5" aria-hidden="true" />
            </Dialog.Close>
          </div>
          <div className="min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-5">{children}</div>
        </Dialog.Popup>
      </Dialog.Viewport>
    </Dialog.Portal>
  </Dialog.Root>;
}
