"use server";

import { revalidatePath } from "next/cache";

import { crearClienteSupabaseServidor } from "@/lib/supabase/server";

export type EstadoAceptacionPedido = { error?: string; aceptado?: boolean };
export type EstadoCancelacionPedido = { error?: string; cancelado?: boolean };
export type EstadoTransicionPedido = { error?: string; actualizado?: boolean };

const mensajesRpc: Record<string, string> = {
  SIN_STOCK_IMPORTE_NO_CERO: "Una línea sin unidades debe confirmarse con importe cero.",
  SIN_STOCK_HISTORICO_INCOMPATIBLE: "El pedido tiene referencias históricas, actividad de reparto o registros contables incompatibles. Requiere revisión administrativa; no se modificó la contabilidad.",
  REFERENCIAS_OPERATIVAS_INCOMPATIBLES: "El pedido tiene asignaciones contradictorias entre rutas y cargas. Requiere revisar esas referencias antes de resolverlo.",
  RUTA_NO_EDITABLE: "La ruta debe estar en preparación y sin salida registrada.",
  PARCIAL_NO_AUTORIZADO: "Confirma las diferencias en el resumen de preparación de la ruta.",
  SIN_STOCK_NO_CONFIRMADO: "Confirma expresamente la falta total de stock en el resumen de la ruta.",
  SIN_PREPARAR: "Un pedido sin productos preparados requiere resolución expresa por falta de stock.",
  REGIMEN_CONTABLE_NO_COMPATIBLE: "El pedido tiene contabilidad histórica; requiere revisión administrativa sin alterar sus cargos previos.",
  CARGA_CONFIRMADA: "Reabre la carga antes de resolver la falta de stock.",
  VERSION_OPERATIVA_CONFLICTO: "Otro cambio actualizó este pedido. Recarga y revisa los valores antes de continuar.",
  CLAVE_IDEMPOTENCIA_EN_USO: "La solicitud cambió. Cierra el control y vuelve a abrirlo.",
  PRODUCTOS_PENDIENTES: "Guarda las cantidades y confirma el resumen de la ruta.",
  IMPORTE_ORIGINAL_REQUERIDO: "Sin cambio de cantidad se conserva el importe autorizado original.",
  PREPARACION_FECHA_NO_HABILITADA: "Preparación bloqueada: la fecha efectiva de entrega debe coincidir con hoy en America/Santiago. Si está vencida o no tiene fecha, requiere un flujo específico de reprogramación aún no disponible.",
  NO_AUTORIZADO: "No tienes permisos para esta operación.",
  PEDIDO_NO_ENCONTRADO: "El pedido ya no existe.",
  ESTADO_PEDIDO_INVALIDO: "El estado actual del pedido no permite esta operación.",
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
  revalidatePath("/admin/rutas");
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
  revalidatePath("/admin/rutas");
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
  revalidatePath("/admin/rutas");
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

