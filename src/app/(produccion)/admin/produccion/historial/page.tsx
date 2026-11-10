import Link from "next/link";
import { consultarProduccion } from "@/lib/produccion/servidor";
import { consultarVersionesProduccion } from "@/lib/produccion/historial";
import { etiquetasActividad, type VersionActividad } from "@/lib/produccion/actividades";
import { fechaValida, nombresUnidad } from "@/lib/produccion/contrato";
import { VersionActividadDetalle } from "@/components/produccion/version-actividad";
const campo = "mt-1 min-h-11 w-full rounded-lg border bg-background px-3 py-2 text-base";
export default async function HistorialPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const consulta = await searchParams;
  const valor = (nombre: string) => typeof consulta[nombre] === "string" ? consulta[nombre] as string : "";
  const desde = valor("desde"), hasta = valor("hasta"), lugar = valor("lugar"), unidad = valor("unidad"), tipo = valor("tipo"), estado = valor("estado");
  const [{ lugares, unidades }, versiones] = await Promise.all([consultarProduccion(), consultarVersionesProduccion()]);
  const error = (desde && !fechaValida(desde)) || (hasta && !fechaValida(hasta)) || (desde && hasta && desde > hasta) || (lugar && !lugares.some(l => l.id === lugar)) || (unidad && !unidades.some(u => u.id === unidad && (!lugar || u.lugar_id === lugar))) || (tipo && !Object.hasOwn(etiquetasActividad, tipo)) || !["", "vigentes", "anuladas"].includes(estado) || Object.values(consulta).some(v => Array.isArray(v));
  const actuales = new Map<string, VersionActividad>();
  for (const version of versiones) if (!actuales.has(version.actividad_id)) actuales.set(version.actividad_id, version);
  const unidadesPorId = new Map(unidades.map(u => [u.id, u]));
  const registros = error ? [] : [...actuales.values()].filter(v => {
    const u = unidadesPorId.get(v.produccion_actividades.unidad_id);
    return (!desde || v.fecha_operativa >= desde) && (!hasta || v.fecha_operativa <= hasta) && (!lugar || u?.lugar_id === lugar) && (!unidad || u?.id === unidad) && (!tipo || v.tipo_actividad === tipo) && (estado === "vigentes" ? v.evento !== "anulacion" : estado === "anuladas" ? v.evento === "anulacion" : true);
  }).sort((a, b) => b.fecha_operativa.localeCompare(a.fecha_operativa) || b.fecha_registro.localeCompare(a.fecha_registro) || a.id.localeCompare(b.id));
  const totalPaginas = Math.max(1, Math.ceil(registros.length / 30));
  const solicitada = Number(valor("pagina") || 1);
  const pagina = Number.isSafeInteger(solicitada) && solicitada > 0 ? Math.min(solicitada, totalPaginas) : 1;
  function enlace(p: number) { const params = new URLSearchParams(); for (const nombre of ["desde", "hasta", "lugar", "unidad", "tipo", "estado"]) if (valor(nombre)) params.set(nombre, valor(nombre)); params.set("pagina", String(p)); return `/admin/produccion/historial?${params}`; }
  return <>
    <div><h1 className="text-3xl font-semibold tracking-tight">Historial de producción</h1><p className="mt-2 text-muted-foreground">Última versión de cada actividad. Las anuladas se muestran sin efecto y no forman parte del registro diario efectivo.</p></div>
    <form method="get" className="grid gap-4 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-3">
      <label className="text-sm font-medium">Desde<input type="date" name="desde" defaultValue={desde} min="0001-01-01" max="9999-12-31" className={campo} /></label><label className="text-sm font-medium">Hasta<input type="date" name="hasta" defaultValue={hasta} min="0001-01-01" max="9999-12-31" className={campo} /></label>
      <label className="text-sm font-medium">Nave o gallinero<select name="lugar" defaultValue={lugar} className={campo}><option value="">Todos los lugares</option>{lugares.map(l => <option key={l.id} value={l.id}>{l.nombre} · {l.tipo}</option>)}</select></label>
      <label className="text-sm font-medium">Unidad<select name="unidad" defaultValue={unidad} className={campo}><option value="">Todas las unidades</option>{unidades.map(u => <option key={u.id} value={u.id}>{lugares.find(l => l.id === u.lugar_id)?.nombre} · {u.nombre} · {nombresUnidad[u.tipo]}</option>)}</select></label>
      <label className="text-sm font-medium">Actividad<select name="tipo" defaultValue={tipo} className={campo}><option value="">Todas las actividades</option>{Object.entries(etiquetasActividad).map(([id, texto]) => <option key={id} value={id}>{texto}</option>)}</select></label>
      <label className="text-sm font-medium">Estado<select name="estado" defaultValue={estado} className={campo}><option value="">Vigentes y anuladas</option><option value="vigentes">Solo vigentes</option><option value="anuladas">Solo anuladas</option></select></label>
      <p className="text-xs text-muted-foreground sm:col-span-2 lg:col-span-3">Para un día, usa la misma fecha en Desde y Hasta. Deja las fechas vacías para consultar todo el historial.</p>
      <button className="min-h-11 rounded-lg bg-primary px-4 font-semibold text-primary-foreground">Filtrar historial</button><Link href="/admin/produccion/historial" className="flex min-h-11 items-center justify-center rounded-lg border px-4 font-semibold">Limpiar filtros</Link>
    </form>
    {error && <p role="alert" className="text-sm text-destructive">Revisa el rango de fechas y los filtros. La unidad debe pertenecer al lugar elegido.</p>}
    {!error && !registros.length && <p className="rounded-xl border border-dashed p-6">No hay actividades para estos filtros.</p>}
    <div className="space-y-4">{registros.slice((pagina - 1) * 30, pagina * 30).map(v => { const u = unidadesPorId.get(v.produccion_actividades.unidad_id); return <article key={v.id} className={`space-y-4 rounded-xl border bg-card p-4 sm:p-6 ${v.evento === "anulacion" ? "border-destructive/40" : ""}`}>
      <p className="break-words text-sm font-medium text-primary">{lugares.find(l => l.id === u?.lugar_id)?.nombre} · {u?.nombre}</p>{v.evento !== "anulacion" && <p className="text-xs font-semibold text-primary">Vigente</p>}<VersionActividadDetalle version={v} /><Link href={`/admin/produccion/historial/${v.actividad_id}`} className="inline-flex min-h-11 items-center rounded-lg border px-4 text-sm font-semibold">Ver detalle, versiones y correcciones</Link>
    </article>; })}</div>
    {registros.length > 0 && <nav aria-label="Páginas del historial" className="flex flex-wrap items-center gap-4">{pagina > 1 && <Link href={enlace(pagina - 1)} className="min-h-11 rounded-lg border px-4 py-3">Anterior</Link>}<span className="text-sm">Página {pagina} de {totalPaginas}</span>{pagina < totalPaginas && <Link href={enlace(pagina + 1)} className="min-h-11 rounded-lg border px-4 py-3">Siguiente</Link>}</nav>}
  </>;
}
