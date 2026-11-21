import "server-only";

import type { ModoCantidadSnapshot } from "@/lib/order-preparation";
import { obtenerIdsReparto, obtenerNombresRepartidores } from "@/lib/reparto/nombres";
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
};

export type ResultadoEntrega = {
  definitivo: number | null;
  productos: Producto[];
  actor: Persona | null;
  rol_actor: "repartidor" | "admin" | null;
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
  const reparto = entradas.some(([, r]) => r.actor && r.rol_actor == null) ? await obtenerIdsReparto() : null;
  const repartidorPorPedido = new Map<string, string>();
  for (const [pedidoId, { actor, rol_actor }] of entradas) {
    // El padrón sólo ayuda a identificar al actor de la entrega en contratos antiguos.
    if (actor?.id && (rol_actor === "repartidor" || (rol_actor == null && reparto?.has(actor.id)))) {
      repartidorPorPedido.set(pedidoId, actor.id);
    }
  }
  const nombre = await obtenerNombresRepartidores(db, [...repartidorPorPedido.values()]);
  return Object.fromEntries(entradas.map(([pedidoId, resultado]) => {
    const id = repartidorPorPedido.get(pedidoId);
    return [pedidoId, { ...resultado, repartidor: id ? { id, nombre: nombre(id) } : null }];
  }));
}
