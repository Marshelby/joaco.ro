import "server-only";
import { crearClienteSupabaseServidor } from "@/lib/supabase/server";
import type { ResultadoEntrega } from "@/lib/admin/resultado-entrega";
import { cache } from "react";
import { obtenerNombresResponsables, rolResponsable } from "@/lib/admin/responsables";

export type ContextoEntrega = {
  disponible: boolean;
  observacion: { texto: string; actor_id: string | null; fecha: string; autor?: string } | null;
  salida: { item_pedido_id: string; cantidad_preparada: number; importe_linea_operativo: number | null }[] | null;
  venta: { total: number | null; productos: { item_pedido_id: string; cantidad_entregada: number; importe_definitivo: number | null }[] } | null;
};
type Fila = Record<string, unknown>;
const objeto = (v: unknown): Fila => v && typeof v === "object" && !Array.isArray(v) ? v as Fila : {};
const lista = (v: unknown): Fila[] => Array.isArray(v) ? v.map(objeto) : [];
const importe = (v: unknown) => typeof v === "number" && Number.isSafeInteger(v) && v >= 0 ? v : null;
const cantidad = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0;

export const leerContextoEntrega = cache(async (id: string): Promise<ContextoEntrega> => {
  const db = await crearClienteSupabaseServidor();
  const { data, error } = await db.rpc("leer_contexto_entrega_admin", { p_pedido_id: id });
  // Despliegue compatible antes del SQL: no inventar ceros ni ocultar otros errores.
  if (error) {
    if (["PGRST202", "42883"].includes(error.code)) return { disponible: false, observacion: null, salida: null, venta: null };
    throw error;
  }
  const contexto = objeto(data), o = objeto(contexto.observacion), v = objeto(contexto.venta);
  const observacion = typeof o.texto === "string" && typeof o.fecha === "string"
    ? { texto: o.texto, actor_id: typeof o.actor_id === "string" ? o.actor_id : null, fecha: o.fecha } : null;
  return {
    disponible: true,
    observacion,
    salida: Array.isArray(contexto.salida) ? lista(contexto.salida).flatMap(p =>
      typeof p.item_pedido_id === "string" && cantidad(p.cantidad_preparada)
        ? [{ item_pedido_id: p.item_pedido_id, cantidad_preparada: p.cantidad_preparada, importe_linea_operativo: importe(p.importe_linea_operativo) }] : []) : null,
    venta: contexto.venta ? { total: importe(v.total), productos: lista(v.productos).flatMap(p =>
      typeof p.item_pedido_id === "string" && cantidad(p.cantidad_entregada)
        ? [{ item_pedido_id: p.item_pedido_id, cantidad_entregada: p.cantidad_entregada, importe_definitivo: importe(p.importe_definitivo) }] : []) } : null,
  };
});

export function responsableObservacion(observacion: ContextoEntrega["observacion"], resultado?: ResultadoEntrega) {
  const id = observacion?.actor_id;
  const rol = id && id === resultado?.actor?.id ? rolResponsable(resultado?.rol_actor) : undefined;
  return { id, rol };
}

export async function obtenerContextoEntrega(id: string, resultados: Promise<Record<string, ResultadoEntrega>>): Promise<ContextoEntrega> {
  const [contexto, entregas] = await Promise.all([leerContextoEntrega(id), resultados]);
  if (!contexto.observacion) return contexto;
  const actor = responsableObservacion(contexto.observacion, entregas[id]);
  const nombre = await obtenerNombresResponsables([actor]);
  return { ...contexto, observacion: { ...contexto.observacion, autor: nombre(actor) } };
}
