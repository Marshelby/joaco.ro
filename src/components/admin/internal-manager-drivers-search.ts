"use server";

import { exigirAdminReparto } from "@/lib/reparto/server";
import type { DriverManagement } from "./internal-manager-drivers-list";

export async function buscarUsuariosReparto(consulta: string) {
  const db = await exigirAdminReparto();
  const busqueda = consulta.trim().slice(0, 100);
  if (busqueda.length < 2) return { usuarios: [] };
  const { data, error } = await db.rpc("leer_gestion_repartidores_admin", { p_busqueda: busqueda });
  if (error || !data) return { error: "No se pudo buscar usuarios. Intenta nuevamente." };
  return { usuarios: (data as DriverManagement).usuarios };
}
