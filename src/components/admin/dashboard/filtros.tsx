import Link from "next/link";
import {
  fechaMaximaDashboard, fechaMinimaDashboard, periodosDashboard,
  type BusquedaDashboard, type PeriodoDashboard,
} from "@/lib/admin/dashboard-periodo";
import { esFechaCalendario } from "@/lib/operational-date";

export function FiltrosDashboard({ periodo, busqueda }: { periodo: PeriodoDashboard | null; busqueda: BusquedaDashboard }) {
  const desde = busqueda.periodo === "personalizado" && esFechaCalendario(busqueda.desde) ? busqueda.desde : periodo?.desde;
  const hasta = busqueda.periodo === "personalizado" && esFechaCalendario(busqueda.hasta) ? busqueda.hasta : periodo?.hasta;

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <nav aria-label="Períodos predefinidos" className="flex flex-wrap gap-2">
        {periodosDashboard.map(([id, nombre]) => (
          <Link prefetch={false} key={id} href={`/admin?periodo=${id}`} aria-current={periodo?.seleccionado === id ? "true" : undefined}
            className={`rounded-lg px-3 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-emerald-700 ${periodo?.seleccionado === id
              ? "bg-emerald-900 text-white" : "bg-slate-100 text-slate-800 hover:bg-slate-200"}`}>
            {nombre}
          </Link>
        ))}
      </nav>
      <details key={JSON.stringify([busqueda.periodo, desde, hasta])} open={busqueda.periodo === "personalizado" ? true : undefined} className="border-t border-slate-100 pt-3">
        <summary className="w-fit cursor-pointer text-sm font-semibold text-emerald-900">Período personalizado</summary>
        <form action="/admin" method="get" aria-describedby="dashboard-fechas-ayuda" className="mt-3 flex flex-wrap items-end gap-3">
          <input type="hidden" name="periodo" value="personalizado" />
          <label className="grid min-w-0 max-w-full gap-1 text-sm font-medium">
            Desde
            <input type="date" name="desde" min={fechaMinimaDashboard} max={fechaMaximaDashboard} defaultValue={desde} required
              className="min-h-10 min-w-0 max-w-full rounded-lg border border-slate-300 bg-white px-2 focus-visible:outline-2 focus-visible:outline-emerald-700" />
          </label>
          <label className="grid min-w-0 max-w-full gap-1 text-sm font-medium">
            Hasta
            <input type="date" name="hasta" min={fechaMinimaDashboard} max={fechaMaximaDashboard} defaultValue={hasta} required
              className="min-h-10 min-w-0 max-w-full rounded-lg border border-slate-300 bg-white px-2 focus-visible:outline-2 focus-visible:outline-emerald-700" />
          </label>
          <button type="submit" className="min-h-10 rounded-lg bg-emerald-900 px-4 text-sm font-semibold text-white hover:bg-emerald-800">Aplicar fechas</button>
          <p id="dashboard-fechas-ayuda" className="w-full text-xs text-slate-600">Hasta 366 días civiles de Santiago, con ambas fechas incluidas.</p>
        </form>
      </details>
    </div>
  );
}
