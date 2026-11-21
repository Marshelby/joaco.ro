"use client";

import { Dialog } from "@base-ui/react/dialog";
import { ArrowLeft, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, type ReactNode } from "react";

import { OrderCustomerNavigation } from "@/components/admin/order-customer-navigation";

export function OrderDetailModal({ children, title = "Detalle de pedido", closeHref, pageHref, vistaRuta = false }: { children: ReactNode; title?: string; closeHref?: string; pageHref?: string; vistaRuta?: boolean }) {
  const router = useRouter();
  const closing = useRef(false);
  const [messagesOpen, setMessagesOpen] = useState(false);
  const [customerOpen, setCustomerOpen] = useState(false);
  const [customerAnchor, setCustomerAnchor] = useState("");

  function close() {
    if (closing.current) return;
    closing.current = true;
    // Rutas proporciona un destino seguro incluso al abrir un enlace compartido.
    // El modal interceptado de Pedidos conserva su cierre mediante historial.
    if (closeHref) router.replace(closeHref, { scroll: false });
    else router.back();
  }

  const vistaPedidoRuta = vistaRuta && !customerOpen;

  return <OrderCustomerNavigation.Provider value={{ messagesOpen, setMessagesOpen, customerOpen, setCustomerOpen, customerAnchor, setCustomerAnchor }}><Dialog.Root open onOpenChange={(open) => { if (!open) close(); }}>
    <Dialog.Portal>
      <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm" />
      <Dialog.Viewport className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-5">
        <Dialog.Popup className="flex max-h-[calc(100dvh-1rem)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl outline-none sm:max-h-[calc(100dvh-2.5rem)]">
          <div className={vistaPedidoRuta ? "flex shrink-0 items-center justify-between gap-2 border-b border-border bg-card px-3 py-1 sm:px-4" : "flex shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-4 py-2 sm:px-5"}>
            <div className="flex min-w-0 flex-wrap items-center gap-2">{customerOpen ? <button type="button" onClick={() => { if (messagesOpen) setMessagesOpen(false); else setCustomerOpen(false); }} className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"><ArrowLeft className="size-5 shrink-0" aria-hidden="true" />{messagesOpen ? "Volver al cliente" : "Volver al pedido"}</button> : null}<Dialog.Title className="text-sm font-semibold text-foreground">{messagesOpen ? "Enviar mensaje" : customerOpen ? "Ficha de cliente" : title}</Dialog.Title></div>
            {pageHref && !customerOpen ? <a href={pageHref} className={vistaPedidoRuta ? "ml-auto inline-flex min-h-11 min-w-0 items-center rounded-md px-2 text-right text-xs font-semibold text-primary underline underline-offset-4 hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring sm:text-sm" : "ml-auto text-sm font-semibold text-primary underline underline-offset-4"}>Abrir página original</a> : null}
            <Dialog.Close type="button" aria-label={`Cerrar ${title.toLowerCase()}`} className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
              <X className="size-5" aria-hidden="true" />
            </Dialog.Close>
          </div>
          <div data-order-modal-scroll className={vistaPedidoRuta ? "min-h-0 overflow-y-auto overscroll-contain bg-muted/25 p-3 sm:p-4" : "min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-5"}>{children}</div>
        </Dialog.Popup>
      </Dialog.Viewport>
    </Dialog.Portal>
  </Dialog.Root></OrderCustomerNavigation.Provider>;
}
