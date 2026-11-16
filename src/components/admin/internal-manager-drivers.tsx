import Link from "next/link";
import { exigirAdminReparto } from "@/lib/reparto/server";
import { InternalManagerDriversList, type DriverManagement } from "./internal-manager-drivers-list";

export default async function InternalManagerDrivers({ resultado, q = "" }: { resultado?: string; q?: string }) {
  const db = await exigirAdminReparto();
  const busqueda = q.trim().slice(0, 100);
  const { data, error } = await db.rpc("leer_gestion_repartidores_admin", { p_busqueda: busqueda });
  return <div className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
      <p>El permiso de reparto no concede administración.</p>
      <Link href="/reparto" className="rounded text-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring">Acceso del equipo ↗</Link>
    </div>
    {resultado && <p role={resultado === "ok" ? "status" : "alert"} className={`rounded-lg border px-3 py-2 text-sm ${resultado === "ok" ? "bg-muted/40" : "border-destructive/40 text-destructive"}`}>{resultado === "ok" ? "Permiso actualizado." : "No se guardó el cambio. Actualiza la página y comprueba que el usuario tenga un perfil válido y no sea administrador."}</p>}
    {error || !data ? <div role="alert" className="rounded-lg border border-destructive/40 p-3 text-sm">No se pudo consultar repartidores. <Link href="/admin/gestor-interno?seccion=repartidores" className="underline">Reintentar</Link></div> :
      <InternalManagerDriversList key={`${busqueda}:${resultado ?? ""}`} gestion={data as DriverManagement} initialQuery={busqueda} />}
  </div>;
}
