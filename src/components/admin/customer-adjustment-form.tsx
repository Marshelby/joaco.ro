"use client";

import { useActionState, useState } from "react";

import { registrarAjusteCuentaCliente } from "@/app/(admin)/admin/clientes/actions";
import { Button } from "@/components/ui/button";
import { formatCLP } from "@/lib/formatters";

export function CustomerAdjustmentForm({ clienteId }: { clienteId: string }) {
  const [tipo, setTipo] = useState<"cargo" | "abono">("cargo");
  const [monto, setMonto] = useState("");
  const [estado, accion, pendiente] = useActionState(registrarAjusteCuentaCliente, {});
  const montoNumero = Number(monto);
  const montoValido = Number.isSafeInteger(montoNumero) && montoNumero > 0;
  const consecuencia = tipo === "cargo" ? "aumentará la deuda" : "reducirá la deuda o aumentará el saldo a favor";

  return (
    <form action={accion} className="space-y-5 rounded-xl border border-border bg-card p-4 sm:p-5">
      <input type="hidden" name="clienteId" value={clienteId} />
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-foreground">Registrar ajuste</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">Un cargo aumenta lo que el cliente debe. Un abono reduce la deuda o aumenta su saldo a favor.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium text-foreground">Tipo<select name="tipo" value={tipo} onChange={(event) => setTipo(event.target.value as "cargo" | "abono")} className="mt-2 h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"><option value="cargo">Cargo</option><option value="abono">Abono</option></select></label>
        <label className="text-sm font-medium text-foreground">Monto<input required name="monto" type="number" inputMode="numeric" min="1" step="1" value={monto} onChange={(event) => setMonto(event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50" /></label>
        <label className="sm:col-span-2 text-sm font-medium text-foreground">Motivo<input required name="motivo" className="mt-2 h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50" /></label>
        <label className="sm:col-span-2 text-sm font-medium text-foreground">Observación <span className="font-normal text-muted-foreground">(opcional)</span><textarea name="observacion" rows={3} className="mt-2 w-full rounded-lg border border-input bg-background p-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50" /></label>
      </div>
      <p className="rounded-lg bg-muted px-3 py-2 text-sm leading-6 text-foreground">{montoValido ? `Este ${tipo} ${consecuencia} en ${formatCLP(montoNumero)}.` : "Ingresa un monto mayor que cero para revisar el efecto del ajuste."}</p>
      <div className="flex flex-wrap items-center gap-3"><Button type="submit" disabled={pendiente}>{pendiente ? "Registrando…" : "Registrar ajuste"}</Button>{estado.exito ? <p aria-live="polite" className="text-sm text-primary">{estado.exito}</p> : null}{estado.error ? <p aria-live="polite" className="text-sm text-destructive">{estado.error}</p> : null}</div>
    </form>
  );
}
