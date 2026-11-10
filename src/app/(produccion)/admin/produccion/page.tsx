import Link from "next/link";
import { RegistroDiario } from "@/components/produccion/registro-diario";
import { consultarActividadesDia, consultarProduccion } from "@/lib/produccion/servidor";
import { fechaValida, hoySantiago, fechaVisible, nombresUnidad } from "@/lib/produccion/contrato";
export default async function ProduccionPage({ searchParams }: { searchParams: Promise<{ fecha?: string | string[] }> }) {
  const consulta = await searchParams;
  const valida = typeof consulta.fecha === "string" && fechaValida(consulta.fecha);
  const fecha = valida ? consulta.fecha as string : hoySantiago();
  const [{ lugares, unidades, configuraciones }, actividades] = await Promise.all([consultarProduccion(), consultarActividadesDia(fecha)]);
  return <>
    <div className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-3xl font-semibold tracking-tight">Producción</h1><p className="mt-2 text-muted-foreground">Registro diario de actividades al {fechaVisible(fecha)}.</p></div><Link href="/admin/produccion/historial" className="min-h-11 rounded-lg border px-4 py-3 text-sm font-semibold">Historial y correcciones</Link><Link href="/admin/produccion/configuracion" className="min-h-11 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground">Configurar producción</Link></div>
    <form className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4" method="get"><label className="text-sm font-medium">Fecha de actividad<input type="date" name="fecha" defaultValue={fecha} min="0001-01-01" max="9999-12-31" required className="mt-1 block min-h-11 rounded-lg border bg-background px-3" /></label><button className="min-h-11 rounded-lg border px-4 text-sm font-semibold">Consultar</button><p className="pb-3 text-xs text-muted-foreground">Zona horaria: America/Santiago</p></form>
    {consulta.fecha !== undefined && !valida && <p role="alert" className="text-sm text-destructive">La fecha no es válida. Se muestra hoy en Santiago.</p>}
    {lugares.length > 0 && <RegistroDiario key={fecha} fecha={fecha} lugares={lugares} unidades={unidades} actividades={actividades} claveInicial={crypto.randomUUID()} />}
    <h2 className="text-xl font-semibold">Lugares y configuración vigente</h2>
    <p className="text-sm text-muted-foreground">Se muestran también los lugares y unidades inactivos para conservar el acceso a su historial. Solo los activos permiten nuevos registros.</p>
    {!lugares.length ? <div className="rounded-xl border border-dashed p-8 text-center"><h2 className="font-semibold">Aún no hay lugares</h2><p className="mt-2 text-muted-foreground">Crea tu primera nave o gallinero desde Configuración.</p></div> : <div className="grid gap-4 lg:grid-cols-2">{lugares.map(l => {
      const propias = unidades.filter(u => u.lugar_id === l.id);
      return <article key={l.id} className="min-w-0 space-y-4 rounded-xl border bg-card p-5 shadow-sm"><div><p className="text-xs font-semibold uppercase tracking-wider text-primary">{l.tipo === "nave" ? "Nave" : "Gallinero"}</p><h2 className="mt-1 break-words text-xl font-semibold">{l.nombre}</h2><p className="mt-1 text-sm">{l.activo ? "Activo" : "Inactivo"}</p>{l.observaciones && <p className="mt-2 whitespace-pre-wrap break-words text-sm text-muted-foreground">{l.observaciones}</p>}</div>
        {!propias.length && <p className="text-sm text-muted-foreground">Sin unidades configuradas.</p>}
        <ul className="space-y-3">{propias.map(u => { const vigente = configuraciones.find(c => c.unidad_id === u.id && c.vigente_desde <= fecha); return <li key={u.id} className="rounded-lg bg-muted/50 p-3"><p className="break-words font-medium">{u.nombre}</p><p className="text-xs text-muted-foreground">{nombresUnidad[u.tipo]}</p><p className="text-xs text-muted-foreground">{u.activo && l.activo ? "Activa" : "Inactiva o lugar inactivo"}</p>{u.observaciones && <p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted-foreground">{u.observaciones}</p>}{["meson", "avicola"].includes(u.tipo) && <p className="mt-2 text-sm">{vigente ? u.tipo === "meson" ? `Capacidad máxima: ${vigente.capacidad_lechugas} lechugas` : `${vigente.cantidad_gallinas} gallinas` : "Sin configuración vigente para esta fecha"}</p>}</li>; })}</ul>
        <Link href={`/admin/produccion/configuracion#lugar-${l.id}`} className="inline-flex min-h-11 items-center text-sm font-semibold text-primary underline underline-offset-4">Ver configuración e historial</Link>
      </article>;
    })}</div>}
  </>;
}
