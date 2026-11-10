import { ArrowRight, Settings2, Sprout } from "lucide-react";
import { CabeceraProduccion, IconoLugar, IdentidadUnidad, EstadoProduccion } from "@/components/produccion/identidad";
import { cultivoEnFecha, nombreCultivo, capacidadVisible } from "@/lib/produccion/cultivos";
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
    <CabeceraProduccion etiqueta="El trabajo de cada día" titulo="Registro diario" descripcion={`Registra y consulta las actividades del ${fechaVisible(fecha)}.`}>
      <Link href="/admin/produccion/historial" className="prod-button">Ver historial<ArrowRight size={15} aria-hidden="true" /></Link><Link href="/admin/produccion/configuracion" className="prod-button"><Settings2 size={15} aria-hidden="true" />Configurar</Link>
    </CabeceraProduccion>
    <form className="prod-date-bar" method="get"><label className="text-xs font-semibold">Fecha de actividad<input type="date" name="fecha" defaultValue={fecha} min="0001-01-01" max="9999-12-31" required className="mt-1 block min-h-11 w-full border px-3 text-base" /></label><button className="prod-button prod-button-primary">Consultar día</button><p>Hora local · Santiago de Chile</p></form>
    {consulta.fecha !== undefined && !valida && <p role="alert" className="text-sm text-destructive">La fecha no es válida. Se muestra hoy en Santiago.</p>}
    {lugares.length > 0 && <RegistroDiario key={fecha} fecha={fecha} lugares={lugares} unidades={unidades.map(u => ({ ...u, cultivo: cultivoEnFecha(u, configuraciones, fecha) }))} actividades={actividades} claveInicial={crypto.randomUUID()} />}
    <div><h2 className="prod-section-heading"><Sprout size={21} aria-hidden="true" />Tus espacios de producción</h2>
    <p className="prod-section-copy">Se muestran también los lugares y unidades inactivos para conservar el acceso a su historial. Solo los activos permiten nuevos registros.</p></div>
    {!lugares.length ? <div className="rounded-xl border border-dashed p-8 text-center"><h2 className="font-semibold">Aún no hay lugares</h2><p className="mt-2 text-muted-foreground">Crea tu primera nave o gallinero desde Configuración.</p></div> : <div className="grid gap-4 lg:grid-cols-2">{lugares.map(l => {
      const propias = unidades.filter(u => u.lugar_id === l.id);
      return <article key={l.id} className="prod-location-card min-w-0 space-y-4 p-5"><div><div className="prod-location-top"><IconoLugar tipo={l.tipo} /><div className="min-w-0 flex-1"><p className="text-xs font-semibold uppercase tracking-wider text-primary">{l.tipo === "nave" ? "Nave" : "Gallinero"}</p><h2 className="mt-1 break-words text-xl font-semibold">{l.nombre}</h2></div><EstadoProduccion activo={l.activo} /></div><p className="mt-3 text-xs text-muted-foreground">{propias.length} {propias.length === 1 ? "unidad configurada" : "unidades configuradas"}</p>{l.observaciones && <p className="mt-2 whitespace-pre-wrap break-words text-sm text-muted-foreground">{l.observaciones}</p>}</div>
        {!propias.length && <p className="text-sm text-muted-foreground">Sin unidades configuradas.</p>}
        <ul className="space-y-3">{propias.map(u => { const vigente = configuraciones.find(c => c.unidad_id === u.id && c.vigente_desde <= fecha); return <li key={u.id} className="prod-unit"><p className="break-words font-medium">{u.nombre}</p><div className="prod-unit-meta"><IdentidadUnidad tipo={u.tipo} cultivo={cultivoEnFecha(u, configuraciones, fecha)}>{nombresUnidad[u.tipo]}{u.tipo === "meson" ? ` · ${nombreCultivo(cultivoEnFecha(u, configuraciones, fecha))}` : ""}</IdentidadUnidad><EstadoProduccion activo={u.activo && l.activo}>{u.activo && l.activo ? "Activa" : "Inactiva o lugar inactivo"}</EstadoProduccion></div>{u.observaciones && <p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted-foreground">{u.observaciones}</p>}{["meson", "avicola"].includes(u.tipo) && <p className="mt-2 text-sm">{vigente ? u.tipo === "meson" ? capacidadVisible(vigente) : `${vigente.cantidad_gallinas} gallinas` : "Sin configuración vigente para esta fecha"}</p>}</li>; })}</ul>
        <Link href={`/admin/produccion/configuracion#lugar-${l.id}`} className="inline-flex min-h-11 items-center text-sm font-semibold text-primary underline underline-offset-4">Ver configuración e historial</Link>
      </article>;
    })}</div>}
  </>;
}
