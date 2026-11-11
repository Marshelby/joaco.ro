import Link from "next/link";
import { exigirAdminReparto } from "@/lib/reparto/server";
import { gestionarReparto } from "./actions";
type Gestion = {
  repartidores: { usuario_id: string; activo: boolean }[];
  asignaciones: { fecha: string; usuario_id: string; version: number }[];
  rutas: { id: string; fecha: string }[];
};
export default async function RepartidoresPage({ searchParams }: { searchParams: Promise<{ resultado?: string }> }) {
  const db = await exigirAdminReparto();
  const { data, error } = await db.rpc("administrar_reparto");
  const { resultado } = await searchParams;
  if (error || !data) return <p role="alert">No se pudo consultar reparto. Comprueba la instalación manual de Fase 5.</p>;
  const gestion = data as Gestion;
  const estilo = "min-h-12 w-full rounded border p-3";
  return <div className="space-y-6">
    <h1 className="text-2xl font-bold">Repartidores y asignaciones</h1>
    <p>Usa el UUID de una cuenta existente en Supabase Auth con perfil de cliente. Este permiso operativo no concede administración. Una jornada completa se asigna a un solo repartidor.</p>
    <p>Acceso móvil para el equipo: <Link href="/reparto" className="underline">/reparto</Link></p>
    {resultado && <p role="status">{resultado === "ok" ? "Cambio guardado." : "No se guardó el cambio. Verifica usuario, permiso y estado de la ruta; actualiza antes de reintentar."}</p>}
    <form action={gestionarReparto} className="max-w-xl space-y-3 rounded-xl border p-4">
      <h2 className="font-semibold">Asignar o revocar permiso</h2><input type="hidden" name="accion" value="rol" />
      <label className="block">UUID del usuario<input className={estilo} name="usuario" required /></label>
      <label className="block">Permiso<select className={estilo} name="activo"><option value="true">Habilitar repartidor</option><option value="false">Revocar repartidor</option></select></label>
      <button className={estilo}>Guardar permiso</button>
    </form>
    <form action={gestionarReparto} className="max-w-xl space-y-3 rounded-xl border p-4">
      <h2 className="font-semibold">Asignar o reasignar jornada</h2><input type="hidden" name="accion" value="asignar" />
      <label className="block">Repartidor<select className={estilo} name="usuario" required>{gestion.repartidores.filter(r => r.activo).map(r => <option key={r.usuario_id}>{r.usuario_id}</option>)}</select></label>
      <label className="block">Ruta principal<select className={estilo} name="ruta" required>{gestion.rutas.map(r => <option key={r.id} value={r.id}>{r.fecha}</option>)}</select></label>
      <button className={estilo}>Guardar asignación</button>
    </form>
    <h2 className="font-semibold">Permisos actuales</h2><ul className="space-y-2">{gestion.repartidores.map(r => <li key={r.usuario_id} className="break-all">{r.usuario_id} · {r.activo ? "Activo" : "Revocado"}</li>)}</ul>
    <h2 className="font-semibold">Asignaciones</h2><ul className="space-y-2">{gestion.asignaciones.map(a => <li key={a.fecha} className="break-all">{a.fecha} · {a.usuario_id} · versión {a.version}</li>)}</ul>
  </div>;
}
