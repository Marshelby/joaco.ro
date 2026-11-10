import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { administradorProduccion, consultarProduccion } from "@/lib/produccion/servidor";
import { consultarVersionesProduccion } from "@/lib/produccion/historial";
import { VersionActividadDetalle } from "@/components/produccion/version-actividad";
import { CambioActividad } from "@/components/produccion/cambio-actividad";
export default async function DetalleActividadPage({ params }: { params: Promise<{ id: string }> }) {
  await administradorProduccion();
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const [versiones, { lugares, unidades }] = await Promise.all([consultarVersionesProduccion(id), consultarProduccion()]);
  const actual = versiones[0];
  if (!actual) notFound();
  const unidad = unidades.find(u => u.id === actual.produccion_actividades.unidad_id);
  const lugar = lugares.find(l => l.id === unidad?.lugar_id);
  return <>
    <Link href="/admin/produccion/historial" className="inline-flex min-h-11 items-center text-sm font-semibold text-primary underline">Volver al historial</Link>
    <div><h1 className="text-3xl font-semibold tracking-tight">Detalle de actividad</h1><p className="mt-2 break-words text-muted-foreground">{lugar?.nombre} · {unidad?.nombre}</p><p className="mt-2 break-all text-xs text-muted-foreground">Actividad: {id}</p></div>
    <section className="space-y-4 rounded-xl border bg-card p-4 sm:p-6"><h2 className="text-xl font-semibold">Estado actual · {actual.evento === "anulacion" ? "Anulada, sin efecto" : "Vigente"}</h2><VersionActividadDetalle version={actual} /></section>
    {actual.evento === "anulacion" ? <p className="rounded-xl border border-destructive/40 p-4 text-sm">Esta actividad está anulada definitivamente. Se conserva para auditoría y no se incluye en los registros efectivos.</p> : <CambioActividad key={actual.id} version={actual} clave={crypto.randomUUID()} />}
    <section className="space-y-4"><h2 className="text-xl font-semibold">Todas las versiones · historial inmutable</h2><p className="text-sm text-muted-foreground">Orden de más reciente a original. Las versiones anteriores se conservan como antecedentes y no se suman como actividades adicionales.</p>{versiones.map((v, i) => <article key={v.id} className="space-y-3 rounded-xl border bg-card p-4 sm:p-6"><p className="text-xs font-semibold text-muted-foreground">{i === 0 ? "Última versión" : "Versión histórica · reemplazada"}</p><VersionActividadDetalle version={v} /><p className="break-all text-xs text-muted-foreground">Versión: {v.id}</p></article>)}</section>
  </>;
}
