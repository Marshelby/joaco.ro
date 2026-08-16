"use client";

import { useActionState, useState } from "react";

import { guardarDiaEntregaAdministrativo, type EstadoDiaEntrega } from "@/app/(admin)/admin/configuracion/actions";
import { Button } from "@/components/ui/button";
import { diaAnterior, esDiaSemanaEntrega, formatearHoraCorte, nombreDiaSemana } from "@/config/delivery-schedule";
import type { DiaEntregaAdministrativo } from "@/lib/admin/dias-entrega";

const estadoInicial: EstadoDiaEntrega = {};

function DeliveryDayRow({ dia }: { dia: DiaEntregaAdministrativo }) {
  const [activo, setActivo] = useState(dia.activo);
  const [horaCorte, setHoraCorte] = useState(dia.horaCorte.slice(0, 5));
  const [estado, accion, pendiente] = useActionState(guardarDiaEntregaAdministrativo, estadoInicial);
  const diaSemana = esDiaSemanaEntrega(dia.diaSemana) ? dia.diaSemana : 1;
  const anterior = diaAnterior(diaSemana);
  const nombre = nombreDiaSemana(diaSemana);

  return (
    <form action={accion} className="grid gap-4 rounded-xl border border-border bg-background p-4 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end sm:gap-5">
      <input type="hidden" name="diaSemana" value={diaSemana} />
      <div className="min-w-0 space-y-1">
        <h3 className="font-semibold text-foreground">{nombre}</h3>
        <p className="text-sm leading-5 text-muted-foreground">Se reciben pedidos hasta el {nombreDiaSemana(anterior).toLocaleLowerCase("es-CL")} a las {formatearHoraCorte(horaCorte)}.</p>
      </div>

      <label className="flex min-h-11 items-center gap-3 text-sm font-medium text-foreground">
        <input name="activo" type="checkbox" checked={activo} onChange={(event) => setActivo(event.target.checked)} className="size-4 accent-primary" />
        {activo ? "Activo" : "Inactivo"}
      </label>

      <label className="grid gap-2 text-sm font-medium text-foreground">
        Hora límite
        <input name="horaCorte" type="time" required step="60" value={horaCorte} onChange={(event) => setHoraCorte(event.target.value)} className="h-11 rounded-lg border border-input bg-card px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50" />
      </label>

      <div className="flex flex-wrap items-center gap-3 sm:col-span-3">
        <Button type="submit" disabled={pendiente}>{pendiente ? "Guardando…" : "Guardar"}</Button>
        {estado.exito ? <p aria-live="polite" className="text-sm text-primary">{estado.exito}</p> : null}
        {estado.error ? <p aria-live="polite" className="text-sm text-destructive">{estado.error}</p> : null}
      </div>
    </form>
  );
}

export function DeliveryDaysSettings({ dias }: { dias: DiaEntregaAdministrativo[] }) {
  return (
    <section className="space-y-5 rounded-xl border border-border bg-card p-4 sm:p-6" aria-labelledby="delivery-days-title">
      <div>
        <h2 id="delivery-days-title" className="text-xl font-semibold tracking-tight text-foreground">Logística de entregas</h2>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">Define los días de reparto y hasta qué hora del día anterior se reciben pedidos. La operación se calcula en horario de Chile.</p>
      </div>
      <div className="space-y-3">{dias.map((dia) => <DeliveryDayRow key={dia.id} dia={dia} />)}</div>
    </section>
  );
}
