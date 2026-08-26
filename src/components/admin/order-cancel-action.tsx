"use client";

import { useActionState } from "react";

import { cancelarPedidoAdmin } from "@/app/(admin)/admin/pedidos/actions";
import { PendingButton } from "@/components/ui/pending-button";

export function OrderCancelAction({ pedidoId }: { pedidoId: string }) {
  const [estado, accion, pendiente] = useActionState(cancelarPedidoAdmin, {});
  return (
    <details className="rounded-lg border border-destructive/25 p-3">
      <summary className="cursor-pointer text-sm font-medium text-destructive">Cancelar pedido</summary>
      <form action={accion} className="mt-3 space-y-3">
        <input type="hidden" name="pedidoId" value={pedidoId} />
        <p className="text-sm leading-6 text-muted-foreground">El pedido dejará de generar deuda y cualquier pago aplicado será liberado.</p>
        <label className="block text-sm font-medium text-foreground">Motivo<input required name="motivo" className="mt-2 h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50" /></label>
        <div className="flex flex-wrap items-center gap-3"><PendingButton type="submit" variant="destructive" pending={pendiente} pendingLabel="Cancelando…">Confirmar cancelación</PendingButton>{estado.cancelado ? <p aria-live="polite" className="text-sm text-primary">Pedido cancelado y aplicaciones liberadas.</p> : null}{estado.error ? <p aria-live="polite" className="text-sm text-destructive">{estado.error}</p> : null}</div>
      </form>
    </details>
  );
}
