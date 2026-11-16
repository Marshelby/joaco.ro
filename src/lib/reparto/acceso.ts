import "server-only";

import { cache } from "react";

import { crearClienteSupabaseServidor } from "@/lib/supabase/server";

// Solo se comparte durante el render actual; el permiso se consulta de nuevo
// en cada petición y /reparto conserva su propia autorización del servidor.
export const tieneAccesoReparto = cache(async (): Promise<boolean> => {
  const db = await crearClienteSupabaseServidor();
  const { data: { user }, error } = await db.auth.getUser();
  if (error || !user) return false;
  const { data, error: permisoError } = await db.rpc("acceso_repartidor");
  return !permisoError && data === true;
});
