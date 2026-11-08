"use client";

import { useActionState, useState } from "react";

import { guardarDiaEntregaAdministrativo, type EstadoDiaEntrega } from "@/app/(admin)/admin/configuracion/actions";
import { PendingButton } from "@/components/ui/pending-button";
import { esDiaSemanaEntrega, nombreDiaSemana } from "@/config/delivery-schedule";
import type { DiaEntregaAdministrativo } from "@/lib/admin/dias-entrega";

const estadoInicial: EstadoDiaEntrega = {};

function DeliveryDayRow({ dia }: { dia: DiaEntregaAdministrativo }) {
  const [activo, setActivo] = useState(dia.activo);
  const [estado, accion, pendiente] = useActionState(guardarDiaEntregaAdministrativo, estadoInicial);
  const diaSemana = esDiaSemanaEntrega(dia.diaSemana) ? dia.diaSemana : 1;
  const nombre = nombreDiaSemana(diaSemana);

  return (
    <form action={accion} className="grid gap-4 rounded-xl border border-border bg-background p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end sm:gap-5">
      <input type="hidden" name="diaSemana" value={diaSemana} />
      <div className="min-w-0 space-y-1">
        <h3 className="font-semibold text-foreground">{nombre}</h3>
        <p className="text-sm leading-5 text-muted-foreground">La entrega para este mismo día se puede solicitar únicamente antes de las 16:00, hora America/Santiago.</p>
      </div>

      <label className="flex min-h-11 items-center gap-3 text-sm font-medium text-foreground">
        <input name="activo" type="checkbox" checked={activo} onChange={(event) => setActivo(event.target.checked)} className="size-4 accent-primary" />
        {activo ? "Activo" : "Inactivo"}
      </label>

      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <PendingButton type="submit" pending={pendiente} pendingLabel="Guardando…">Guardar</PendingButton>
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
        <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">Activa los días de reparto. Los clientes pueden solicitar entrega para el mismo día habilitado únicamente antes de las 16:00, hora America/Santiago.</p>
      </div>
      <div className="space-y-3">{dias.map((dia) => <DeliveryDayRow key={dia.id} dia={dia} />)}</div>
    </section>
  );
}
