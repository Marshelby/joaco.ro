import "server-only";

import { cache } from "react";
import { crearClienteSupabaseServidor } from "@/lib/supabase/server";
import { obtenerNombresResponsables } from "@/lib/admin/responsables";

export const leerIntentosPedidoAdmin = cache(async (id: string) => {
  const db = await crearClienteSupabaseServidor();
  return db.rpc("leer_intentos_pedido_admin", { p_pedido_id: id });
});

function texto(valor: unknown) {
  return typeof valor === "string" && valor.trim() ? valor : null;
}

export async function obtenerUltimoFalloEntrega(id: string) {
  const { data, error } = await leerIntentosPedidoAdmin(id);
  if (error || !Array.isArray(data?.intentos)) return null;
  // El lector devuelve los intentos en orden de versión.
  const intento = data.intentos.at(-1);
  if (!intento) return null;
  const actorId = texto(intento.actor);
  const nombres = actorId ? await obtenerNombresResponsables([actorId]) : null;
  return { motivo: texto(intento.motivo), observaciones: texto(intento.observaciones), fecha: texto(intento.fecha), actor: actorId && nombres ? nombres(actorId) : null };
}
