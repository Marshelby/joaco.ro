"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { registrarPagoCliente } from "@/app/(admin)/admin/clientes/actions";
import { Button } from "@/components/ui/button";
import { describirSaldoCuenta } from "@/lib/account-balance";
import { formatCLP } from "@/lib/formatters";

const mediosPago = [
  { value: "transferencia", label: "Transferencia" },
  { value: "efectivo", label: "Efectivo" },
  { value: "tarjeta", label: "Tarjeta" },
  { value: "pago_web", label: "Pago web" },
  { value: "otro", label: "Otro" },
] as const;

export function CustomerPaymentForm({ clienteId, saldoActual }: { clienteId: string; saldoActual: number }) {
  const [monto, setMonto] = useState("");
  const [metodo, setMetodo] = useState<(typeof mediosPago)[number]["value"]>("transferencia");
  const claveIdempotencia = useRef("");
  const [estado, accion, pendiente] = useActionState(registrarPagoCliente, {});
  const montoNumero = Number(monto);
  const montoValido = Number.isSafeInteger(montoNumero) && montoNumero > 0;
  const saldoPosterior = saldoActual - (montoValido ? montoNumero : 0);
  const saldoDescripcion = describirSaldoCuenta(saldoPosterior);

  useEffect(() => {
    if (estado.exito) claveIdempotencia.current = "";
  }, [estado.exito]);

  return (
    <form action={accion} onSubmit={(event) => { const input = event.currentTarget.elements.namedItem("claveIdempotencia") as HTMLInputElement; claveIdempotencia.current ||= crypto.randomUUID(); input.value = claveIdempotencia.current; }} className="space-y-5 rounded-xl border border-border bg-card p-4 sm:p-5">
      <input type="hidden" name="clienteId" value={clienteId} />
      <input type="hidden" name="claveIdempotencia" defaultValue="" />
      <div><h2 className="text-lg font-semibold tracking-tight text-foreground">Registrar pago</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">El pago se confirma y se aplica automáticamente a los pedidos pendientes más antiguos.</p></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium text-foreground">Monto recibido<input required name="monto" type="number" inputMode="numeric" min="1" step="1" value={monto} onChange={(event) => setMonto(event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50" /></label>
        <label className="text-sm font-medium text-foreground">Medio de pago<select name="metodoPago" value={metodo} onChange={(event) => setMetodo(event.target.value as typeof metodo)} className="mt-2 h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50">{mediosPago.map((medio) => <option key={medio.value} value={medio.value}>{medio.label}</option>)}</select></label>
        <label className="sm:col-span-2 text-sm font-medium text-foreground">Referencia <span className="font-normal text-muted-foreground">(opcional)</span><input name="referencia" className="mt-2 h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50" /></label>
        <label className="sm:col-span-2 text-sm font-medium text-foreground">Observación <span className="font-normal text-muted-foreground">(opcional)</span><textarea name="observacion" rows={3} className="mt-2 w-full rounded-lg border border-input bg-background p-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50" /></label>
      </div>
      <p className="rounded-lg bg-muted px-3 py-2 text-sm leading-6 text-foreground">{montoValido ? `Registrar pago recibido por ${formatCLP(montoNumero)} vía ${mediosPago.find((medio) => medio.value === metodo)?.label.toLowerCase()}. Después, el cliente quedará aproximadamente ${saldoDescripcion.texto === "Al día" ? "al día" : saldoDescripcion.texto === "Debe" ? `debiendo ${formatCLP(saldoDescripcion.monto)}` : `con ${formatCLP(saldoDescripcion.monto)} a favor`}.` : `Saldo actual: ${saldoActual === 0 ? "Al día" : saldoActual > 0 ? `Debe ${formatCLP(saldoActual)}` : `${formatCLP(Math.abs(saldoActual))} a favor`}.`}</p>
      <div className="flex flex-wrap items-center gap-3"><Button type="submit" disabled={pendiente}>{pendiente ? "Registrando…" : "Registrar pago"}</Button>{estado.exito ? <p aria-live="polite" className="text-sm text-primary">{estado.exito}</p> : null}{estado.error ? <p aria-live="polite" className="text-sm text-destructive">{estado.error}</p> : null}</div>
    </form>
  );
}
