"use server";

import { revalidatePath } from "next/cache";

import { crearClienteSupabaseServidor } from "@/lib/supabase/server";

export type EstadoAceptacionPedido = { error?: string; aceptado?: boolean };

const mensajesRpc: Record<string, string> = {
  NO_AUTORIZADO: "No tienes permisos para aceptar pedidos.",
  PEDIDO_NO_ENCONTRADO: "El pedido ya no existe.",
  ESTADO_PEDIDO_INVALIDO: "Este pedido ya no puede aceptarse desde su estado actual.",
};

export async function aceptarPedidoAdmin(_: EstadoAceptacionPedido, datos: FormData): Promise<EstadoAceptacionPedido> {
  const pedidoId = String(datos.get("pedidoId") ?? "").trim();
  if (!pedidoId) return { error: "No fue posible identificar el pedido." };

  const supabase = await crearClienteSupabaseServidor();
  const { data: sesion } = await supabase.auth.getUser();
  if (!sesion.user) return { error: "Tu sesión expiró. Inicia sesión nuevamente." };

  const { error } = await supabase.rpc("aceptar_pedido_administrativo", { p_pedido_id: pedidoId });
  if (error) return { error: mensajesRpc[error.message] ?? "No fue posible aceptar el pedido." };

  revalidatePath("/admin");
  revalidatePath("/admin/pedidos");
  revalidatePath(`/admin/pedidos/${pedidoId}`);
  return { aceptado: true };
}
