import "server-only";

import { crearClienteSupabaseServidor } from "@/lib/supabase/server";

type Persona = { id: string; nombre: string | null };
type Producto = {
  item_pedido_id: string;
  nombre_producto: string;
  nombre_presentacion: string | null;
  unidad: string;
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
  total_cobrado: number | null;
};

export async function obtenerResultadosEntrega(ids: string[]): Promise<Record<string, ResultadoEntrega>> {
  const unicos = [...new Set(ids)];
  if (!unicos.length) return {};
  const db = await crearClienteSupabaseServidor();
  const resultados: Record<string, ResultadoEntrega> = {};
  for (let inicio = 0; inicio < unicos.length; inicio += 100) {
    const { data, error } = await db.rpc("leer_resultados_entrega_admin", { p_pedidos: unicos.slice(inicio, inicio + 100) });
    if (error) {
      if (["PGRST202", "42883"].includes(error.code)) return resultados;
      throw error;
    }
    Object.assign(resultados, data);
  }
  return resultados;
}
