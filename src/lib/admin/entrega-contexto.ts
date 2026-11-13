import "server-only";
import { crearClienteSupabaseServidor } from "@/lib/supabase/server";
import { obtenerNombresResponsables } from "@/lib/admin/responsables";

export type ContextoEntrega = {
  disponible: boolean;
  observacion: { texto: string; actor_id: string; fecha: string; autor: string } | null;
  salida: { item_pedido_id: string; cantidad_preparada: number; importe_linea_operativo: number | null }[] | null;
  venta: { total: number | null; productos: { item_pedido_id: string; cantidad_entregada: number; importe_definitivo: number | null }[] } | null;
};
type Fila = Record<string, unknown>;
const objeto = (v: unknown): Fila => v && typeof v === "object" && !Array.isArray(v) ? v as Fila : {};
const lista = (v: unknown): Fila[] => Array.isArray(v) ? v.map(objeto) : [];
const importe = (v: unknown) => typeof v === "number" && Number.isSafeInteger(v) && v >= 0 ? v : null;
const cantidad = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0;

export async function obtenerContextoEntrega(id: string): Promise<ContextoEntrega> {
  const db = await crearClienteSupabaseServidor();
  const { data, error } = await db.rpc("leer_contexto_entrega_admin", { p_pedido_id: id });
  // Despliegue compatible antes del SQL: no inventar ceros ni ocultar otros errores.
  if (error) {
    if (["PGRST202", "42883"].includes(error.code)) return { disponible: false, observacion: null, salida: null, venta: null };
    throw error;
  }
  const contexto = objeto(data), o = objeto(contexto.observacion), v = objeto(contexto.venta);
  const observacion = typeof o.texto === "string" && typeof o.actor_id === "string" && typeof o.fecha === "string"
    ? { texto: o.texto, actor_id: o.actor_id, fecha: o.fecha } : null;
  const nombre = observacion ? await obtenerNombresResponsables([observacion.actor_id]) : null;
  return {
    disponible: true,
    observacion: observacion ? { ...observacion, autor: nombre!(observacion.actor_id) } : null,
    salida: Array.isArray(contexto.salida) ? lista(contexto.salida).flatMap(p =>
      typeof p.item_pedido_id === "string" && cantidad(p.cantidad_preparada)
        ? [{ item_pedido_id: p.item_pedido_id, cantidad_preparada: p.cantidad_preparada, importe_linea_operativo: importe(p.importe_linea_operativo) }] : []) : null,
    venta: contexto.venta ? { total: importe(v.total), productos: lista(v.productos).flatMap(p =>
      typeof p.item_pedido_id === "string" && cantidad(p.cantidad_entregada)
        ? [{ item_pedido_id: p.item_pedido_id, cantidad_entregada: p.cantidad_entregada, importe_definitivo: importe(p.importe_definitivo) }] : []) } : null,
  };
}
