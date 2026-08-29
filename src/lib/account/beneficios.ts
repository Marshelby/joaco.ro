import "server-only";

import { obtenerClienteActual } from "@/lib/account/identity";
import { crearClienteSupabaseServidor } from "@/lib/supabase/server";

export type CuponDisponibleCuenta = {
  id: string;
};

export type BeneficiosCuenta = {
  comprasAcumuladas: number;
  cuponesDisponibles: readonly CuponDisponibleCuenta[];
};

type CuponDisponibleFila = {
  id: string;
};

export async function obtenerBeneficiosCuenta(): Promise<BeneficiosCuenta | null> {
  const cliente = await obtenerClienteActual();
  if (!cliente) return null;

  const supabase = await crearClienteSupabaseServidor();
  const [stacksResult, cuponesResult] = await Promise.all([
    supabase
      .from("beneficios_stacks")
      .select("*", { count: "exact", head: true })
      .eq("cliente_id", cliente.id)
      .is("cupon_id", null),
    supabase
      .from("cupones_cliente")
      .select("id")
      .eq("cliente_id", cliente.id)
      .eq("estado", "disponible")
      .order("fecha_creacion", { ascending: true }),
  ]);

  if (stacksResult.error || cuponesResult.error) {
    throw new Error("No fue posible cargar tus beneficios.");
  }

  return {
    comprasAcumuladas: stacksResult.count ?? 0,
    cuponesDisponibles: (cuponesResult.data as unknown as CuponDisponibleFila[] | null ?? []).map((cupon) => ({ id: cupon.id })),
  };
}
