"use server";

import { revalidatePath } from "next/cache";

import { crearClienteSupabaseServidor } from "@/lib/supabase/server";

export type EstadoAceptacionPedido = { error?: string; aceptado?: boolean };
export type EstadoCancelacionPedido = { error?: string; cancelado?: boolean };
export type EstadoTransicionPedido = { error?: string; actualizado?: boolean };
export type EstadoPreparacionItem = { error?: string; guardado?: boolean; completo?: boolean };
export type EstadoFinalizacionPreparacion = { error?: string; finalizado?: boolean };

const mensajesRpc: Record<string, string> = {
  NO_AUTORIZADO: "No tienes permisos para aceptar pedidos.",
  PEDIDO_NO_ENCONTRADO: "El pedido ya no existe.",
  ESTADO_PEDIDO_INVALIDO: "Este pedido ya no puede aceptarse desde su estado actual.",
  MOTIVO_REQUERIDO: "Indica el motivo de la cancelación.",
  ITEM_PEDIDO_NO_ENCONTRADO: "No encontramos este producto del pedido.",
  CANTIDAD_PREPARADA_REQUERIDA: "Ingresa la cantidad preparada.",
  CANTIDAD_PREPARADA_INVALIDA: "La cantidad preparada debe ser cero o mayor.",
  CANTIDAD_PREPARADA_SUPERA_SOLICITADA: "La cantidad preparada no puede superar la solicitada.",
  CANTIDAD_PREPARADA_DEBE_SER_ENTERA: "Esta presentación sólo admite cantidades enteras.",
  MOTIVO_DEMASIADO_LARGO: "El motivo no puede superar 400 caracteres.",
  PREPARACION_PENDIENTE_DE_FINALIZACION: "Registra o finaliza la preparación antes de marcar el pedido listo.",
  PREPARACION_COMPLETA_INCONSISTENTE: "No fue posible validar el monto del pedido completo.",
  TOTAL_FINAL_INVALIDO: "El total final calculado no es válido.",
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

export async function finalizarPreparacionPedidoAction(_: EstadoFinalizacionPreparacion, datos: FormData): Promise<EstadoFinalizacionPreparacion> {
  const pedidoId = String(datos.get("pedidoId") ?? "").trim();
  if (!pedidoId) return { error: "No fue posible identificar el pedido." };
  const supabase = await crearClienteSupabaseServidor();
  const { data: sesion } = await supabase.auth.getUser();
  if (!sesion.user) return { error: "Tu sesión expiró. Inicia sesión nuevamente." };
  const { data: pedido } = await supabase.from("pedidos").select("cliente_id,fecha_entrega").eq("id", pedidoId).maybeSingle();
  const { error } = await supabase.rpc("finalizar_preparacion_pedido_administrativo", { p_pedido_id: pedidoId });
  if (error) return { error: mensajesRpc[error.message] ?? "No fue posible finalizar la preparación." };
  revalidatePath("/admin"); revalidatePath("/admin/pedidos"); revalidatePath(`/admin/pedidos/${pedidoId}`);
  if (pedido?.fecha_entrega) revalidatePath(`/admin/pedidos/entregas/${pedido.fecha_entrega}`);
  revalidatePath("/admin/clientes"); if (pedido?.cliente_id) revalidatePath(`/admin/clientes/${pedido.cliente_id}`);
  revalidatePath("/mi-cuenta/pedidos"); revalidatePath(`/mi-cuenta/pedidos/${pedidoId}`); revalidatePath(`/pedido/confirmacion/${pedidoId}`);
  return { finalizado: true };
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

export async function guardarPreparacionItemPedido(_: EstadoPreparacionItem, datos: FormData): Promise<EstadoPreparacionItem> {
  const itemPedidoId = String(datos.get("itemPedidoId") ?? "").trim();
  const volverACompleto = datos.get("volverACompleto") === "true";
  const cantidadTexto = String(datos.get("cantidadPreparada") ?? "").trim();
  const cantidadPreparadaFormulario = Number(cantidadTexto);
  const motivo = String(datos.get("motivo") ?? "").trim();
  if (!itemPedidoId) return { error: "No fue posible identificar el producto." };
  if (!volverACompleto && !Number.isFinite(cantidadPreparadaFormulario)) return { error: "Ingresa una cantidad preparada válida." };

  const supabase = await crearClienteSupabaseServidor();
  const { data: sesion } = await supabase.auth.getUser();
  if (!sesion.user) return { error: "Tu sesión expiró. Inicia sesión nuevamente." };

  const { data: item } = await supabase.from("items_pedido").select("pedido_id,cantidad").eq("id", itemPedidoId).maybeSingle();
  const { data: pedido } = item
    ? await supabase.from("pedidos").select("cliente_id,fecha_entrega").eq("id", item.pedido_id).maybeSingle()
    : { data: null };
  const { data, error } = await supabase.rpc("guardar_preparacion_item_pedido_administrativo", {
    p_item_pedido_id: itemPedidoId,
    p_cantidad_preparada: volverACompleto && item ? Number(item.cantidad) : cantidadPreparadaFormulario,
    p_motivo: motivo || null,
  });
  if (error) return { error: mensajesRpc[error.message] ?? "No fue posible guardar la preparación." };

  revalidatePath("/admin");
  revalidatePath("/admin/pedidos");
  if (pedido?.fecha_entrega) revalidatePath(`/admin/pedidos/entregas/${pedido.fecha_entrega}`);
  if (item?.pedido_id) revalidatePath(`/admin/pedidos/${item.pedido_id}`);
  if (pedido?.cliente_id) revalidatePath(`/admin/clientes/${pedido.cliente_id}`);

  const resultado = Array.isArray(data) ? data[0] : data;
  return { guardado: true, completo: resultado?.tiene_faltante === false };
}
