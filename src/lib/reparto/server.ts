import "server-only";
import { redirect } from "next/navigation";
import { crearClienteSupabaseServidor } from "@/lib/supabase/server";

export async function exigirRepartidor() {
  const db = await crearClienteSupabaseServidor();
  const { data: { user }, error } = await db.auth.getUser();
  if (error || !user) redirect("/iniciar-sesion?returnTo=%2Freparto");
  const { data: permitido, error: permisoError } = await db.rpc("acceso_repartidor");
  if (permisoError || permitido !== true) redirect("/reparto/sin-acceso");
  return db;
}

export async function exigirAdminReparto() {
  const db = await crearClienteSupabaseServidor();
  const { data: { user }, error } = await db.auth.getUser();
  if (error || !user) redirect("/iniciar-sesion");
  const { data, error: permisoError } = await db.rpc("es_admin");
  if (permisoError || data !== true) redirect("/");
  return db;
}
