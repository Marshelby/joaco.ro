import "server-only";

import { cache } from "react";
import { crearClienteSupabaseServidor } from "@/lib/supabase/server";
import { obtenerNombresResponsables, rolResponsable } from "@/lib/admin/responsables";

export const leerIntentosPedidoAdmin = cache(async (id: string) => {
  const db = await crearClienteSupabaseServidor();
  return db.rpc("leer_intentos_pedido_admin", { p_pedido_id: id });
});

function texto(valor: unknown) {
  return typeof valor === "string" && valor.trim() ? valor : null;
}

export async function leerUltimoFalloEntrega(id: string) {
  const { data, error } = await leerIntentosPedidoAdmin(id);
  if (error || !Array.isArray(data?.intentos)) return null;
  // El lector devuelve los intentos en orden de versión.
  const intento = data.intentos.at(-1);
  if (!intento) return null;
  const actorId = texto(intento.actor);
  return { motivo: texto(intento.motivo), observaciones: texto(intento.observaciones), fecha: texto(intento.fecha), version: typeof intento.version === "number" ? intento.version : null, actorId, rol: intento.origen === "sin_stock_pre_despacho" ? ("admin" as const) : rolResponsable(intento.rol_actor) };
}

export async function obtenerUltimosFallosEntrega(ids: readonly string[]) {
  const unicos = [...new Set(ids)];
  const fallos = await Promise.all(unicos.map(leerUltimoFalloEntrega));
  const nombre = await obtenerNombresResponsables(fallos.flatMap(f => f ? [{ id: f.actorId, rol: f.rol }] : []));
  return new Map(unicos.map((id, i) => {
    const fallo = fallos[i];
    return [id, fallo ? { ...fallo, actor: nombre({ id: fallo.actorId, rol: fallo.rol }) } : null] as const;
  }));
}

export async function obtenerUltimoFalloEntrega(id: string) {
  return (await obtenerUltimosFallosEntrega([id])).get(id) ?? null;
}
