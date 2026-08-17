"use server";

import { revalidatePath } from "next/cache";

import { crearClienteSupabaseServidor } from "@/lib/supabase/server";

export type EstadoAceptacionPedido = { error?: string; aceptado?: boolean };
export type EstadoCancelacionPedido = { error?: string; cancelado?: boolean };
export type EstadoTransicionPedido = { error?: string; actualizado?: boolean };

const mensajesRpc: Record<string, string> = {
  NO_AUTORIZADO: "No tienes permisos para aceptar pedidos.",
  PEDIDO_NO_ENCONTRADO: "El pedido ya no existe.",
  ESTADO_PEDIDO_INVALIDO: "Este pedido ya no puede aceptarse desde su estado actual.",
  MOTIVO_REQUERIDO: "Indica el motivo de la cancelación.",
};

async function actualizarEstadoPedido(
  _: EstadoTransicionPedido,
  datos: FormData,
  rpc: "marcar_pedido_preparando_administrativo" | "marcar_pedido_listo_despacho_administrativo" | "marcar_pedido_en_reparto_administrativo" | "marcar_pedido_entregado_administrativo",
): Promise<EstadoTransicionPedido> {
  const pedidoId = String(datos.get("pedidoId") ?? "").trim();
  if (!pedidoId) return { error: "No fue posible identificar el pedido." };

  const supabase = await crearClienteSupabaseServidor();
  const { data: sesion } = await supabase.auth.getUser();
  if (!sesion.user) return { error: "Tu sesión expiró. Inicia sesión nuevamente." };

  const { data: pedido } = await supabase.from("pedidos").select("cliente_id,fecha_entrega").eq("id", pedidoId).maybeSingle();
  const { error } = await supabase.rpc(rpc, { p_pedido_id: pedidoId });
  if (error) return { error: mensajesRpc[error.message] ?? "No fue posible actualizar el estado del pedido." };

  revalidatePath("/admin");
  revalidatePath("/admin/pedidos");
  revalidatePath(`/admin/pedidos/${pedidoId}`);
  if (pedido?.fecha_entrega) revalidatePath(`/admin/pedidos/entregas/${pedido.fecha_entrega}`);
  revalidatePath("/admin/clientes");
  if (pedido?.cliente_id) revalidatePath(`/admin/clientes/${pedido.cliente_id}`);
  revalidatePath("/mi-cuenta/pedidos");
  revalidatePath(`/mi-cuenta/pedidos/${pedidoId}`);
  return { actualizado: true };
}

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

export async function cancelarPedidoAdmin(_: EstadoCancelacionPedido, datos: FormData): Promise<EstadoCancelacionPedido> {
  const pedidoId = String(datos.get("pedidoId") ?? "").trim();
  const motivo = String(datos.get("motivo") ?? "").trim();
  if (!pedidoId) return { error: "No fue posible identificar el pedido." };

  const supabase = await crearClienteSupabaseServidor();
  const { data: sesion } = await supabase.auth.getUser();
  if (!sesion.user) return { error: "Tu sesión expiró. Inicia sesión nuevamente." };
  const { error } = await supabase.rpc("cancelar_pedido_administrativo", { p_pedido_id: pedidoId, p_motivo: motivo });
  if (error) return { error: mensajesRpc[error.message] ?? "No fue posible cancelar el pedido." };

  revalidatePath("/admin");
  revalidatePath("/admin/clientes");
  revalidatePath("/admin/pedidos");
  revalidatePath(`/admin/pedidos/${pedidoId}`);
  return { cancelado: true };
}

export async function marcarPedidoPreparando(_: EstadoTransicionPedido, datos: FormData) {
  return actualizarEstadoPedido(_, datos, "marcar_pedido_preparando_administrativo");
}

export async function marcarPedidoListoDespacho(_: EstadoTransicionPedido, datos: FormData) {
  return actualizarEstadoPedido(_, datos, "marcar_pedido_listo_despacho_administrativo");
}

export async function marcarPedidoEnReparto(_: EstadoTransicionPedido, datos: FormData) {
  return actualizarEstadoPedido(_, datos, "marcar_pedido_en_reparto_administrativo");
}

export async function marcarPedidoEntregado(_: EstadoTransicionPedido, datos: FormData) {
  return actualizarEstadoPedido(_, datos, "marcar_pedido_entregado_administrativo");
}
