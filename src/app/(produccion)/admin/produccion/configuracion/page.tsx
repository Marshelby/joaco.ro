import { Settings2, Plus, Warehouse } from "lucide-react";
import { CabeceraProduccion, IconoLugar, IdentidadUnidad, EstadoProduccion } from "@/components/produccion/identidad";
import { cultivoEnFecha, nombreCultivo, capacidadVisible } from "@/lib/produccion/cultivos";
import { EditarEntidad } from "@/components/produccion/editar-entidad";
import { consultarProduccion } from "@/lib/produccion/servidor";
import { hoySantiago, fechaVisible, nombresUnidad } from "@/lib/produccion/contrato";
import { FormularioProduccion } from "@/components/produccion/formulario";
export default async function ConfiguracionProduccionPage() {
  const { lugares, unidades, configuraciones } = await consultarProduccion();
  const fecha = hoySantiago();
  const naves = lugares.filter(l => l.tipo === "nave" && l.activo);
  return <>
    <CabeceraProduccion etiqueta="Organiza tu campo" titulo="Configuración" descripcion="Administra tus naves, gallineros y unidades de cultivo. Cada cambio conserva su historia." />
    <aside className="prod-note">Edita nombres y descripciones o cambia el estado sin perder historial. Los tipos y las relaciones se conservan. Las capacidades y cantidades de gallinas se agregan con una nueva fecha de vigencia.</aside>
    <div className="grid items-start gap-6 md:grid-cols-2">
      <section className="space-y-4 rounded-xl border bg-card p-5"><h2 className="prod-section-heading"><Plus size={20} aria-hidden="true" />Crear lugar</h2><p className="text-sm text-muted-foreground">Al crear un gallinero podrás configurar sus gallinas inmediatamente.</p><FormularioProduccion operacion="lugar" clave={crypto.randomUUID()} fecha={fecha} /></section>
      <section className="space-y-4 rounded-xl border bg-card p-5"><h2 className="prod-section-heading"><Warehouse size={20} aria-hidden="true" />Agregar unidad</h2>{naves.length ? <FormularioProduccion operacion="unidad" clave={crypto.randomUUID()} fecha={fecha} lugares={naves} /> : <p className="text-sm text-muted-foreground">Primero crea una nave para agregar mesones, sectores de flores o cultivos de suelo.</p>}</section>
    </div>
    <h2 className="prod-section-heading"><Settings2 size={20} aria-hidden="true" />Lugares y configuraciones</h2>
    {!lugares.length && <p className="rounded-xl border border-dashed p-6 text-muted-foreground">Aún no hay lugares registrados.</p>}
    {lugares.map(l => <section id={`lugar-${l.id}`} key={l.id} className="prod-location-card scroll-mt-24 space-y-5 p-4 sm:p-6">
      <div><div className="prod-location-top"><IconoLugar tipo={l.tipo} /><div className="min-w-0 flex-1"><p className="text-xs font-semibold uppercase tracking-wider text-primary">{l.tipo === "nave" ? "Nave" : "Gallinero"}</p><h3 className="break-words text-xl font-semibold">{l.nombre}</h3></div><EstadoProduccion activo={l.activo} /></div>{l.observaciones && <p className="mt-2 whitespace-pre-wrap break-words text-sm text-muted-foreground">{l.observaciones}</p>}</div>
      <EditarEntidad key={`${l.id}-${l.version}`} entidad="lugar" registro={l} />
      {!unidades.some(u => u.lugar_id === l.id) && <p className="text-sm text-muted-foreground">Todavía no tiene unidades. Agrégalas en el formulario superior.</p>}
      <div className="grid items-start gap-4 lg:grid-cols-2">{unidades.filter(u => u.lugar_id === l.id).map(u => {
        const historial = configuraciones.filter(c => c.unidad_id === u.id);
        const vigente = historial.find(c => c.vigente_desde <= fecha);
        return <article key={u.id} className="prod-unit min-w-0 space-y-4">
          <div><h4 className="break-words font-semibold">{u.nombre}</h4><div className="prod-unit-meta"><IdentidadUnidad tipo={u.tipo} cultivo={cultivoEnFecha(u, configuraciones, fecha)}>{nombresUnidad[u.tipo]}{u.tipo === "meson" ? ` · ${nombreCultivo(cultivoEnFecha(u, configuraciones, fecha))}` : ""}</IdentidadUnidad><EstadoProduccion activo={u.activo && l.activo}>{!l.activo ? "Lugar inactivo" : u.activo ? "Activa" : "Inactiva"}</EstadoProduccion></div>{u.observaciones && <p className="mt-2 whitespace-pre-wrap break-words text-sm text-muted-foreground">{u.observaciones}</p>}</div>
          <EditarEntidad key={`${u.id}-${u.version}`} entidad="unidad" registro={u} padreActivo={l.activo} />
          {u.tipo === "meson" || u.tipo === "avicola" ? <>
            <p className="rounded-lg bg-primary/5 p-3 text-sm">{vigente ? `Vigente hoy: ${u.tipo === "meson" ? capacidadVisible(vigente) : `${vigente.cantidad_gallinas} gallinas`}` : "Sin configuración vigente hoy"}</p>
            {u.activo && l.activo && <details className="rounded-lg border p-3"><summary className="cursor-pointer py-2 text-sm font-semibold">Agregar configuración</summary><div className="pt-3"><FormularioProduccion operacion="configuracion" clave={crypto.randomUUID()} unidadId={u.id} cultivo={cultivoEnFecha(u, configuraciones, fecha)} avicola={u.tipo === "avicola"} fecha={fecha} /></div></details>}
            <details><summary className="cursor-pointer py-3 text-sm font-semibold">Historial de configuraciones ({historial.length})</summary>
              {!historial.length ? <p className="text-sm text-muted-foreground">Todavía no hay configuraciones.</p> : <ol className="space-y-3">{historial.map((c, i) => <li key={c.id} className="rounded-lg bg-muted/50 p-3 text-sm"><p className="font-medium">Desde {fechaVisible(c.vigente_desde)}{i > 0 ? ` hasta antes del ${fechaVisible(historial[i - 1].vigente_desde)}` : " en adelante"}</p><p>{u.tipo === "meson" ? capacidadVisible(c) : `${c.cantidad_gallinas} gallinas`}</p><p className="mt-1 text-xs text-muted-foreground">{c.vigente_desde > fecha ? "Programada" : c.id === vigente?.id ? "Vigente hoy" : "Histórica"}</p>{c.observaciones && <p className="mt-2 whitespace-pre-wrap break-words text-muted-foreground">{c.observaciones}</p>}</li>)}</ol>}
            </details>
          </> : <p className="text-sm text-muted-foreground">Esta unidad no requiere configuración de capacidad en esta fase.</p>}
        </article>;
      })}</div>
    </section>)}
  </>;
}
