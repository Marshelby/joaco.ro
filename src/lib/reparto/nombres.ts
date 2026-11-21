import "server-only";

import { cache } from "react";
import { crearClienteSupabaseServidor } from "@/lib/supabase/server";
import { NOMBRE_REPARTIDOR_NO_REGISTRADO } from "./nombre";

export async function obtenerNombresRepartidores(
  db: Awaited<ReturnType<typeof crearClienteSupabaseServidor>>,
  ids: readonly string[],
) {
  const unicos = [...new Set(ids)];
  const nombres = new Map<string, string>();
  for (let i = 0; i < unicos.length; i += 100) {
    const { data, error } = await db.from("clientes").select("usuario_id,nombre").in("usuario_id", unicos.slice(i, i + 100));
    if (error) throw error;
    for (const cliente of data ?? []) {
      const nombre = cliente.nombre?.trim();
      if (cliente.usuario_id && nombre) nombres.set(cliente.usuario_id, nombre);
    }
  }
  return (id: string) => nombres.get(id) ?? NOMBRE_REPARTIDOR_NO_REGISTRADO;
}

// Los lectores históricos sin rol del actor pueden identificar cuentas de reparto,
// incluidas las revocadas, mediante el padrón administrativo existente.
export const obtenerIdsReparto = cache(async () => {
  const db = await crearClienteSupabaseServidor();
  const { data, error } = await db.rpc("leer_gestion_repartidores_admin", { p_busqueda: "" });
  if (error || !Array.isArray(data?.repartidores)) return new Set<string>();
  const repartidores = data.repartidores as { usuario_id: string; administrador: boolean }[];
  return new Set(repartidores.filter(r => !r.administrador).map(r => r.usuario_id));
});
