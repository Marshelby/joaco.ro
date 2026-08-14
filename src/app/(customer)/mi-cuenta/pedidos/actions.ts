"use server";

import { obtenerIdentidadActual } from "@/lib/account/identity";
import { obtenerLineasRepetiblesPedido } from "@/lib/account/pedidos";
import type { LineasRepetiblesPedido } from "@/lib/account/pedidos";

export type ResultadoPrepararRepeticion =
  | { estado: "ok"; lineasValidas: LineasRepetiblesPedido["lineasValidas"]; lineasOmitidas: LineasRepetiblesPedido["lineasOmitidas"] }
  | { estado: "no_autorizado" }
  | { estado: "pedido_no_encontrado" }
  | { estado: "error" };

export async function prepararRepeticionPedido(pedidoId: string): Promise<ResultadoPrepararRepeticion> {
  const identidad = await obtenerIdentidadActual();
  if (!identidad || identidad.rol !== "cliente") return { estado: "no_autorizado" };

  try {
    const resultado = await obtenerLineasRepetiblesPedido(pedidoId);
    if (!resultado) return { estado: "pedido_no_encontrado" };
    return { estado: "ok", ...resultado };
  } catch {
    return { estado: "error" };
  }
}
