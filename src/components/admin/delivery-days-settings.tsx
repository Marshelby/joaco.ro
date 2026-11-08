"use client";

import { useActionState, useState } from "react";

import { guardarDiaEntregaAdministrativo, guardarHoraCorteAdministrativa, type EstadoDiaEntrega } from "@/app/(admin)/admin/configuracion/actions";
import { PendingButton } from "@/components/ui/pending-button";
import { esDiaSemanaEntrega, formatearHoraCorte, nombreDiaSemana } from "@/config/delivery-schedule";
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
        <p className="text-sm leading-5 text-muted-foreground">Habilita o deshabilita las entregas de este día.</p>
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

function DeliveryCutoffSettings({ hora }: { hora: string }) {
  const [estado, accion, pendiente] = useActionState(guardarHoraCorteAdministrativa, estadoInicial);
  return (
    <form action={accion} className="space-y-3 rounded-xl border border-border p-4">
      <label htmlFor="hora-corte" className="block text-sm font-medium">Hora límite para pedidos con entrega el mismo día</label>
      <input id="hora-corte" name="horaCorte" type="time" step="60" required defaultValue={formatearHoraCorte(hora)} className="min-h-11 rounded-lg border border-input bg-background px-3 text-foreground" />
      <p className="text-sm text-muted-foreground">Hora de America/Santiago. Antes del límite se puede elegir hoy si está habilitado; desde esa hora, hoy deja de estar disponible.</p>
      <PendingButton type="submit" pending={pendiente} pendingLabel="Guardando…">Guardar hora límite</PendingButton>
      <p aria-live="polite" className={estado.error ? "text-sm text-destructive" : "text-sm text-primary"}>{estado.error ?? estado.exito}</p>
      {estado.diagnostico ? <p className="break-words text-xs text-muted-foreground">{estado.diagnostico}</p> : null}
    </form>
  );
}

export function DeliveryDaysSettings({ dias }: { dias: DiaEntregaAdministrativo[] }) {
  return (
    <section className="space-y-5 rounded-xl border border-border bg-card p-4 sm:p-6" aria-labelledby="delivery-days-title">
      <div>
        <h2 id="delivery-days-title" className="text-xl font-semibold tracking-tight text-foreground">Logística de entregas</h2>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">Configura la hora límite y los días de reparto habilitados.</p>
      </div>
      <DeliveryCutoffSettings hora={dias[0]?.horaCorte ?? "16:00"} />
      <div className="space-y-3">{dias.map((dia) => <DeliveryDayRow key={dia.id} dia={dia} />)}</div>
    </section>
  );
}
