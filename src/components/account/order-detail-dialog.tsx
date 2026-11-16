"use client";

import { Dialog } from "@base-ui/react/dialog";
import { ChevronRight, LoaderCircle, X } from "lucide-react";
import { useRef, useState } from "react";

import { cargarDetallePedido } from "@/app/(customer)/mi-cuenta/pedidos/actions";
import { OrderDetail } from "@/components/account/order-detail";
import type { PedidoCuentaDetalle } from "@/lib/account/pedidos";
import { ROUTES } from "@/config/routes";

export function OrderDetailDialog({ pedidoId, numeroPedido }: { pedidoId: string; numeroPedido: string }) {
  const [open, setOpen] = useState(false);
  const [order, setOrder] = useState<PedidoCuentaDetalle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const request = useRef(0);

  async function load() {
    const current = ++request.current;
    setOrder(null);
    setError(null);
    setLoading(true);
    try {
      const result = await cargarDetallePedido(pedidoId);
      if (current !== request.current) return;
      setOrder(result.order);
      setError(result.error);
    } catch {
      if (current === request.current) setError("No fue posible cargar el pedido. Revisa tu conexión e inténtalo nuevamente.");
    } finally {
      if (current === request.current) setLoading(false);
    }
  }

  return <Dialog.Root open={open} onOpenChange={(next) => {
    setOpen(next);
    if (next) void load();
    else { request.current++; setOrder(null); setError(null); }
  }}>
    <Dialog.Trigger className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50" aria-label={`Ver más sobre el pedido ${numeroPedido}`}>
      Ver más <ChevronRight className="size-4" aria-hidden="true" />
    </Dialog.Trigger>
    <Dialog.Portal>
      <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm" />
      <Dialog.Viewport className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-6">
        <Dialog.Popup className="flex max-h-[calc(100dvh-1rem)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl outline-none sm:max-h-[calc(100dvh-3rem)]">
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-4 py-2 sm:px-6">
            <div className="min-w-0">
              <Dialog.Title className="text-base font-semibold text-foreground">Detalle de {numeroPedido}</Dialog.Title>
              <Dialog.Description className="text-xs text-muted-foreground">Productos, entrega y seguimiento de tu compra.</Dialog.Description>
            </div>
            <Dialog.Close aria-label="Cerrar detalle del pedido" className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"><X className="size-5" aria-hidden="true" /></Dialog.Close>
          </div>
          <div className="min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6" aria-busy={loading}>
            {loading ? <div role="status" className="flex min-h-48 items-center justify-center gap-3 text-sm text-muted-foreground"><LoaderCircle className="size-5 animate-spin" aria-hidden="true" />Cargando tu pedido…</div> : null}
            {error ? <div className="space-y-4 rounded-xl border border-border bg-card p-5"><p role="alert" className="text-sm text-foreground">{error}</p><button type="button" onClick={() => void load()} className="min-h-11 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">Reintentar</button><a href={ROUTES.customerOrder(pedidoId)} className="ml-4 inline-flex min-h-11 items-center text-sm font-semibold text-primary underline underline-offset-4">Abrir página del pedido</a></div> : null}
            {order ? <OrderDetail order={order} modal /> : null}
          </div>
        </Dialog.Popup>
      </Dialog.Viewport>
    </Dialog.Portal>
  </Dialog.Root>;
}
