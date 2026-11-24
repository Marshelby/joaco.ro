import "server-only";

import type { ModoCantidadSnapshot } from "@/lib/order-preparation";
import { obtenerNombresResponsables, rolResponsable } from "@/lib/admin/responsables";
import { crearClienteSupabaseServidor } from "@/lib/supabase/server";

type Persona = { id: string; nombre: string | null };
type Producto = {
  item_pedido_id: string;
  nombre_producto: string;
  nombre_presentacion: string | null;
  unidad: string;
  modo_cantidad?: ModoCantidadSnapshot | null;
  cantidad_pedida: number | null;
  cantidad_entregada: number | null;
  importe_original: number | null;
  importe_definitivo: number | null;
  total_final_administrativo?: number | null;
  precio_final_unitario_referencia?: number | null;
};

export type ResultadoEntrega = {
  definitivo: number | null;
  productos: Producto[];
  actor: Persona | null;
  rol_actor: "repartidor" | "admin" | "cliente" | "sistema" | null;
  repartidor: Persona | null;
  total_cobrado: number | null;
};

type ResultadoEntregaRpc = Omit<ResultadoEntrega, "repartidor">;

export async function obtenerResultadosEntrega(ids: string[]): Promise<Record<string, ResultadoEntrega>> {
  const unicos = [...new Set(ids)];
  if (!unicos.length) return {};
  const db = await crearClienteSupabaseServidor();
  const resultados: Record<string, ResultadoEntregaRpc> = {};
  for (let inicio = 0; inicio < unicos.length; inicio += 100) {
    const { data, error } = await db.rpc("leer_resultados_entrega_admin", { p_pedidos: unicos.slice(inicio, inicio + 100) });
    if (error) {
      if (["PGRST202", "42883"].includes(error.code)) break;
      throw error;
    }
    Object.assign(resultados, data);
  }
  const entradas = Object.entries(resultados);
  const nombre = await obtenerNombresResponsables(entradas.map(([, r]) =>
    ({ id: r.actor?.id, rol: rolResponsable(r.rol_actor) })));
  return Object.fromEntries(entradas.map(([pedidoId, resultado]) => {
    const { actor, rol_actor } = resultado;
    const responsable = actor ? { ...actor, nombre: nombre({ id: actor.id, rol: rolResponsable(rol_actor) }) } : null;
    return [pedidoId, { ...resultado, actor: responsable, repartidor: rol_actor === "repartidor" ? responsable : null }];
  }));
}
