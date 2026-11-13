import "server-only";
import { crearClienteSupabaseServidor } from "@/lib/supabase/server";

type Metodo = { metodo: string; monto: number };
export type ResumenContablePedido = {
  regimen: string;
  importe_definitivo: number | null;
  total_aplicado: number | null;
  saldo_pedido: number | null;
  aplicaciones: Metodo[];
  cobros_entrega: Metodo[] | null;
  saldo_favor_origen_entrega: number | null;
  repartidor: { id: string; nombre: string } | null;
};

export async function obtenerResumenContablePedido(id: string): Promise<ResumenContablePedido | null> {
  const db = await crearClienteSupabaseServidor();
  const { data, error } = await db.rpc("leer_resumen_contable_pedido_admin", { p_pedido_id: id });
  if (error) {
    if (["PGRST202", "42883"].includes(error.code)) return null;
    throw error;
  }
  return data as ResumenContablePedido | null;
}
