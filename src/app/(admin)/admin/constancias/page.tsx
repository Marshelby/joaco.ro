import Link from "next/link";

import { PageHeader } from "@/components/shared/page-header";
import { ActionLink } from "@/components/ui/action-link";
import { ROUTES } from "@/config/routes";
import { listarConstancias } from "@/lib/admin/constancias";
import { exigirSesionAdmin } from "@/lib/admin/sesion";
import { esFechaCalendario, formatearFechaCalendario, hoySantiago, sumarDiasCalendario } from "@/lib/operational-date";
import { ListaConstancias } from "./lista-constancias";

const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function moverMes(mes: string, paso: number) {
  const fecha = new Date(`${mes}T00:00:00Z`);
  fecha.setUTCMonth(fecha.getUTCMonth() + paso);
  const siguiente = fecha.toISOString().slice(0, 10);
  return esFechaCalendario(siguiente) ? siguiente : null;
}

export default async function ConstanciasPage({ searchParams }: { searchParams: Promise<{ fecha?: string; mes?: string; volver?: string | string[] }> }) {
  const supabase = await exigirSesionAdmin();
  const { fecha, mes: mesSolicitado, volver } = await searchParams;
  const consultaPedidos = new URLSearchParams(typeof volver === "string" ? volver : "");
  const pedidosHref = consultaPedidos.size ? `${ROUTES.adminOrders}?${consultaPedidos}` : ROUTES.adminOrders;
  function enlaceCalendario(parametros: { fecha: string } | { mes: string }) {
    const consulta = new URLSearchParams(parametros);
    if (consultaPedidos.size) consulta.set("volver", consultaPedidos.toString());
    return `${ROUTES.adminConstancias}?${consulta}`;
  }
  const seleccion = esFechaCalendario(fecha) ? fecha : null;
  const hoy = hoySantiago();
  const referencia = seleccion ?? (esFechaCalendario(mesSolicitado) ? mesSolicitado : hoy);
  const mes = `${referencia.slice(0, 7)}-01`;
  const anterior = moverMes(mes, -1);
  const siguiente = moverMes(mes, 1);
  const ultimo = siguiente ? sumarDiasCalendario(siguiente, -1) : `${mes.slice(0, 7)}-31`;
  const resultadoFechas = await supabase.from("fechas_constancias_fotograficas")
    .select("dia_constancia").gte("dia_constancia", mes).lte("dia_constancia", ultimo)
    .order("dia_constancia", { ascending: false });
  const fechas = new Set<string>(resultadoFechas.data?.map(dia => dia.dia_constancia) ?? []);
  const activa = seleccion ?? (fechas.has(hoy) ? hoy : resultadoFechas.data?.[0]?.dia_constancia);
  const [lista, resultadoReciente] = await Promise.all([
    activa ? listarConstancias(supabase, activa).catch(() => null) : null,
    !resultadoFechas.error && !fechas.size
      ? supabase.from("fechas_constancias_fotograficas").select("dia_constancia").order("dia_constancia", { ascending: false }).limit(1).maybeSingle()
      : null,
  ]);
  const reciente = resultadoReciente?.data?.dia_constancia;
  const desfase = (new Date(`${mes}T00:00:00Z`).getUTCDay() + 6) % 7;

  return <>
    <PageHeader title="Constancias" description="Fotografías de constancias de entrega firmadas." actions={<ActionLink href={pedidosHref} variant="secondary">Volver a Pedidos</ActionLink>} />
    <div className="grid items-start gap-5 lg:grid-cols-[20rem_minmax(0,1fr)]">
      <section aria-label="Calendario de constancias" className="space-y-3 rounded-xl border bg-card p-3">
        <div className="flex items-center justify-between gap-2">
          {anterior && <Link href={enlaceCalendario({ mes: anterior })} prefetch={false} aria-label="Mes anterior" className="grid size-11 place-items-center rounded-lg border">‹</Link>}
          <h2 className="text-sm font-semibold capitalize">{formatearFechaCalendario(mes, { month: "long", year: "numeric" })}</h2>
          {siguiente && <Link href={enlaceCalendario({ mes: siguiente })} prefetch={false} aria-label="Mes siguiente" className="grid size-11 place-items-center rounded-lg border">›</Link>}
        </div>
        {resultadoFechas.error ? <p role="alert" className="text-sm text-destructive">No se pudo cargar el calendario. Recarga la página para reintentar.</p> :
          <div className="grid grid-cols-7 items-center gap-1 text-center text-xs">
            {DIAS.map(dia => <span key={dia} className="py-1 text-muted-foreground">{dia}</span>)}
            {Array.from({ length: desfase }, (_, indice) => <span key={indice} aria-hidden="true" />)}
            {Array.from({ length: Number(ultimo.slice(-2)) }, (_, indice) => {
              const dia = sumarDiasCalendario(mes, indice);
              const texto = formatearFechaCalendario(dia, { dateStyle: "long" });
              return fechas.has(dia)
                ? <Link key={dia} href={enlaceCalendario({ fecha: dia })} prefetch={false} aria-current={dia === activa ? "date" : undefined} aria-label={texto}
                    className={`grid min-h-10 place-items-center rounded-md border border-primary/35 text-sm font-semibold ${dia === activa ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary hover:bg-primary/20"}`}>{indice + 1}</Link>
                : <span key={dia} className="grid min-h-10 place-items-center text-muted-foreground">{indice + 1}</span>;
            })}
          </div>}
        {reciente && !reciente.startsWith(mes.slice(0, 7)) && <Link href={enlaceCalendario({ fecha: reciente })} prefetch={false} className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline">Ir a la fecha más reciente con fotos</Link>}
      </section>
      {activa && (lista === null
        ? <p role="alert" className="rounded-xl border bg-card p-4 text-sm text-destructive">No se pudieron cargar las constancias. Recarga la página para reintentar.</p>
        : <ListaConstancias key={activa} fecha={activa} constancias={lista} />)}
      {!activa && !resultadoFechas.error && <p className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">No hay constancias para este mes.</p>}
    </div>
  </>;
}
