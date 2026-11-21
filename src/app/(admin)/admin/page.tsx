import type { Metadata } from "next";
import { Suspense } from "react";

import { FiltrosDashboard } from "@/components/admin/dashboard/filtros";
import { ConclusionesComerciales, RankingsComerciales } from "@/components/admin/dashboard/rankings";
import { FinanzasComerciales, VentasComerciales } from "@/components/admin/dashboard/ventas-finanzas";
import { AdminDashboardSkeleton } from "@/components/feedback/admin-loading-skeletons";
import { leerDashboardComercial } from "@/lib/admin/dashboard-comercial";
import { resolverPeriodoDashboard, type BusquedaDashboard, type PeriodoDashboard } from "@/lib/admin/dashboard-periodo";
import { exigirSesionAdmin } from "@/lib/admin/sesion";
import { formatDateCL } from "@/lib/formatters";

export const metadata: Metadata = { title: "Inteligencia comercial · Administración" };

function rango(desde: string, hasta: string) {
  return desde === hasta ? formatDateCL(desde) : `${formatDateCL(desde)} – ${formatDateCL(hasta)}`;
}

export default function AdminPage({ searchParams }: { searchParams: Promise<BusquedaDashboard> }) {
  return (
    <Suspense fallback={<AdminDashboardSkeleton />}>
      <ContenidoDashboard searchParams={searchParams} />
    </Suspense>
  );
}

async function ContenidoDashboard({ searchParams }: { searchParams: Promise<BusquedaDashboard> }) {
  await exigirSesionAdmin();
  const busqueda = await searchParams;
  const periodo = resolverPeriodoDashboard(busqueda);

  return (
    <div className="space-y-5 text-slate-950">
      <header className="rounded-2xl border border-emerald-100 bg-emerald-50 px-5 py-6 sm:px-7">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Inteligencia comercial</h1>
        <p className="mt-2 text-sm text-slate-700">Ventas, pagos y clientes de Hidro Leufú.</p>
      </header>
      <FiltrosDashboard periodo={"error" in periodo ? null : periodo} busqueda={busqueda} />
      {"error" in periodo ? (
        <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-950">{periodo.error}</p>
      ) : (
        <>
          <div className="space-y-1 text-sm">
            <p className="font-semibold">{rango(periodo.desde, periodo.hasta)}</p>
            <p className="text-slate-700">Anterior · {rango(periodo.anteriorDesde, periodo.anteriorHasta)} · {periodo.dias} {periodo.dias === 1 ? "día civil" : "días civiles"} por período</p>
          </div>
          <Suspense key={`${periodo.desde}:${periodo.hasta}`} fallback={<AdminDashboardSkeleton />}>
            <DatosDashboard periodo={periodo} />
          </Suspense>
        </>
      )}
    </div>
  );
}

async function DatosDashboard({ periodo }: { periodo: PeriodoDashboard }) {
  const { ventas, finanzas, rankings } = await leerDashboardComercial(periodo);
  const hayFuenteConError = !ventas || !finanzas || !rankings;
  const lecturasDiscrepan = ventas && rankings && (["actual", "anterior"] as const).some((clave) => {
    const venta = ventas.periodos[clave];
    const ranking = rankings.periodos[clave];
    return venta.ventas_reconocidas_clp !== ranking.ventas_reconocidas_clp ||
      venta.pedidos_con_venta_reconocida !== ranking.pedidos_con_venta_reconocida ||
      venta.cobertura.estado_ventas !== ranking.cobertura.estado_ventas;
  });
  return (
    <div className="space-y-4">
      <nav aria-label="Secciones del dashboard" className="flex flex-wrap gap-x-4 gap-y-2 text-sm font-medium text-emerald-900 underline underline-offset-4">
        <a href="#ventas">Ventas</a>
        <a href="#conclusiones">Conclusiones</a>
        <a href="#saldos">Saldos</a>
        <a href="#pagos">Pagos</a>
        <a href="#rankings">Rankings</a>
      </nav>
      {(hayFuenteConError || lecturasDiscrepan) && (
        <form action="/admin" method="get" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-950">
          <div role="status">
            {hayFuenteConError && <p>{ventas || finanzas || rankings
              ? "Algunos indicadores están temporalmente no disponibles."
              : "No se pudo cargar ningún indicador comercial."}</p>}
            {lecturasDiscrepan && <p>Las lecturas de ventas y rankings difieren. La comparación y sus conclusiones están temporalmente no disponibles.</p>}
          </div>
          <input type="hidden" name="periodo" value="personalizado" />
          <input type="hidden" name="desde" value={periodo.desde} />
          <input type="hidden" name="hasta" value={periodo.hasta} />
          <button type="submit" className="rounded-lg border border-current px-3 py-2 font-semibold">Reintentar consulta</button>
        </form>
      )}
      <VentasComerciales datos={ventas} comparacion={lecturasDiscrepan ? undefined : rankings?.comparacion} />
      <ConclusionesComerciales datos={rankings} lecturasDiscrepan={Boolean(lecturasDiscrepan)} />
      <FinanzasComerciales datos={finanzas} />
      <RankingsComerciales datos={rankings} />
    </div>
  );
}
