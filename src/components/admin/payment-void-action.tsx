"use client";

import { useActionState } from "react";

import { anularPagoCliente } from "@/app/(admin)/admin/clientes/actions";
import { Button } from "@/components/ui/button";

export function PaymentVoidAction({ clienteId, pagoId }: { clienteId: string; pagoId: string }) {
  const [estado, accion, pendiente] = useActionState(anularPagoCliente, {});
  return (
    <details className="mt-3 rounded-lg border border-destructive/25 p-3">
      <summary className="cursor-pointer text-sm font-medium text-destructive">Anular pago</summary>
      <form action={accion} className="mt-3 space-y-3">
        <input type="hidden" name="clienteId" value={clienteId} />
        <input type="hidden" name="pagoId" value={pagoId} />
        <p className="text-sm leading-6 text-muted-foreground">Las aplicaciones de este pago se liberarán y la cuenta del cliente será recalculada.</p>
        <label className="block text-sm font-medium text-foreground">Motivo<input required name="motivo" className="mt-2 h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50" /></label>
        <div className="flex flex-wrap items-center gap-3"><Button type="submit" variant="destructive" disabled={pendiente}>{pendiente ? "Anulando…" : "Confirmar anulación"}</Button>{estado.exito ? <p aria-live="polite" className="text-sm text-primary">{estado.exito}</p> : null}{estado.error ? <p aria-live="polite" className="text-sm text-destructive">{estado.error}</p> : null}</div>
      </form>
    </details>
  );
}
