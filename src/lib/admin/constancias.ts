import "server-only";

import type { Constancia } from "@/lib/constancias";
import type { exigirSesionAdmin } from "./sesion";

type Supabase = Awaited<ReturnType<typeof exigirSesionAdmin>>;

export async function listarConstancias(supabase: Supabase, fecha: string): Promise<Constancia[]> {
  const constancias: Constancia[] = [];
  let ultimoPedido: string | undefined;

  while (true) {
    let consulta = supabase.from("constancias_fotograficas")
      .select("pedido_id,numero_pedido,nombre_cliente_snapshot,fecha_entrega,actualizada_en")
      .eq("dia_constancia", fecha).order("pedido_id").limit(100);
    if (ultimoPedido) consulta = consulta.gt("pedido_id", ultimoPedido);
    const { data, error } = await consulta;
    if (error) throw error;
    if (!data.length) return constancias;
    constancias.push(...data);
    ultimoPedido = data.at(-1)?.pedido_id;
  }
}
