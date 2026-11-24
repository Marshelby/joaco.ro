import { nombrePersonal } from "@/lib/admin/responsables";
import { exigirAdminReparto } from "@/lib/reparto/server";
import { InternalManagerAdministratorsList, type GestionAdministradores } from "./internal-manager-administrators-list";

export default async function InternalManagerAdministrators() {
  const db = await exigirAdminReparto();
  const { data, error } = await db.rpc("leer_gestion_administradores");

  if (error || !data) {
    return <p role="alert" className="rounded-lg border border-destructive/40 p-3 text-sm">
      {error?.code === "PGRST202"
        ? "La gestión de administradores requiere la instalación del SQL revisado."
        : "No se pudo cargar la gestión de administradores. Vuelve a intentar."}
    </p>;
  }

  const gestion = data as GestionAdministradores;
  return <InternalManagerAdministratorsList gestion={{ ...gestion, administradores: gestion.administradores.map(usuario => ({
    ...usuario, nombre: nombrePersonal(usuario.nombre),
  })) }} />;
}
