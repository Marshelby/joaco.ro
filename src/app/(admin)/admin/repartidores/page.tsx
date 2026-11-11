import Link from "next/link";
import { exigirAdminReparto } from "@/lib/reparto/server";
import { PermissionForm } from "./permission-form";

type Usuario = { usuario_id: string; nombre: string | null; correo: string | null };
type Gestion = {
  repartidores: (Usuario & { activo: boolean; administrador: boolean })[];
  usuarios: Usuario[];
};

export default async function RepartidoresPage({ searchParams }: { searchParams: Promise<{ resultado?: string; q?: string }> }) {
  const db = await exigirAdminReparto();
  const { resultado, q = "" } = await searchParams;
  const busqueda = q.trim().slice(0, 100);
  const { data, error } = await db.rpc("leer_gestion_repartidores_admin", { p_busqueda: busqueda });
  const gestion = !error && data ? data as Gestion : null;
  return <div className="space-y-6">
    <h1 className="text-2xl font-bold">Repartidores</h1>
    <p>Gestiona el acceso del equipo de reparto. Este permiso operativo no concede administración.</p>
    <p>Acceso móvil para el equipo: <Link href="/reparto" className="underline">/reparto</Link></p>
    {resultado && <p role={resultado === "ok" ? "status" : "alert"}>{resultado === "ok" ? "Permiso actualizado." : "No se guardó el cambio. Actualiza la página y comprueba que el usuario tenga un perfil válido y no sea administrador."}</p>}
    {!gestion ? <div role="alert" className="rounded-xl border p-4">No se pudo consultar repartidores. Comprueba la instalación del SQL manual de gestión de repartidores. <Link href="/admin/repartidores" className="underline">Reintentar</Link></div> : <>
      <section className="max-w-xl space-y-3 rounded-xl border p-4" aria-labelledby="habilitar-title">
        <h2 id="habilitar-title" className="font-semibold">Habilitar repartidor</h2>
        <form action="/admin/repartidores" className="space-y-3">
          <label className="block">Buscar por nombre o correo
            <input type="search" name="q" defaultValue={busqueda} minLength={2} maxLength={100} required className="mt-2 min-h-12 w-full rounded border bg-background p-3" />
          </label>
          <button className="min-h-12 w-full rounded border p-3">Buscar usuarios</button>
        </form>
        {busqueda.length < 2 ? <p className="text-sm text-muted-foreground">Introduce al menos dos caracteres para buscar cuentas registradas.</p> : gestion.usuarios.length ? <>
          <p className="text-sm text-muted-foreground">Hasta 30 resultados. Los administradores y repartidores activos se excluyen; afina la búsqueda si es necesario.</p>
          <PermissionForm usuarios={gestion.usuarios} />
        </> : <p role="status">No hay usuarios disponibles que coincidan con la búsqueda.</p>}
      </section>
      <section className="space-y-3" aria-labelledby="permisos-title">
        <h2 id="permisos-title" className="font-semibold">Permisos actuales</h2>
        {!gestion.repartidores.length ? <p role="status">Todavía no hay repartidores habilitados ni permisos revocados.</p> :
          <ul className="grid gap-3 sm:grid-cols-2">{gestion.repartidores.map(r => <li key={r.usuario_id} className="min-w-0 space-y-3 rounded-xl border p-4">
            <div><p className="break-words font-semibold">{r.nombre || "Sin nombre"}</p><p className="break-all text-sm text-muted-foreground">{r.correo || "Sin correo registrado"}</p></div>
            <p>Estado: {r.activo ? "Habilitado" : "Revocado"}{r.administrador ? " · Perfil administrador, sin acceso de repartidor" : ""}</p>
            {!r.administrador && <PermissionForm usuarios={[r]} activo={!r.activo} />}
          </li>)}</ul>}
      </section>
    </>}
  </div>;
}
