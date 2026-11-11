"use server";

import { revalidatePath } from "next/cache";

import { crearClienteSupabaseServidor } from "@/lib/supabase/server";

export type EstadoAceptacionPedido = { error?: string; aceptado?: boolean };
export type EstadoCancelacionPedido = { error?: string; cancelado?: boolean };
export type EstadoTransicionPedido = { error?: string; actualizado?: boolean };
export type EstadoPreparacionItem = { error?: string; guardado?: boolean };
export type EstadoFinalizacionPreparacion = { error?: string; finalizado?: boolean };

const mensajesRpc: Record<string, string> = {
  SIN_STOCK_IMPORTE_NO_CERO: "Una línea sin unidades debe confirmarse con importe cero.",
  SIN_STOCK_HISTORICO_INCOMPATIBLE: "El pedido tiene referencias históricas, actividad de reparto o registros contables incompatibles. Requiere revisión administrativa; no se modificó la contabilidad.",
  REFERENCIAS_OPERATIVAS_INCOMPATIBLES: "El pedido tiene asignaciones contradictorias entre rutas y cargas. Requiere revisar esas referencias antes de resolverlo.",
  RUTA_NO_EDITABLE: "La ruta debe estar en preparación y sin salida registrada.",
  PARCIAL_NO_AUTORIZADO: "Autoriza expresamente el parcial e indica un motivo.",
  SIN_STOCK_NO_CONFIRMADO: "Confirma todos los productos con cantidad e importe cero y la falta total de stock.",
  SIN_PREPARAR: "Un pedido sin productos preparados requiere resolución expresa por falta de stock.",
  REGIMEN_CONTABLE_NO_COMPATIBLE: "El pedido tiene contabilidad histórica; requiere revisión administrativa sin alterar sus cargos previos.",
  CARGA_CONFIRMADA: "Reabre la carga antes de resolver la falta de stock.",
  VERSION_OPERATIVA_CONFLICTO: "Otro cambio actualizó este pedido. Recarga y revisa los valores antes de continuar.",
  CLAVE_IDEMPOTENCIA_EN_USO: "La solicitud cambió. Cierra el control y vuelve a abrirlo.",
  PRODUCTOS_PENDIENTES: "Confirma explícitamente todos los productos antes de finalizar.",
  IMPORTE_MANUAL_REQUERIDO: "Si cambia la cantidad, ingresa un nuevo importe total manual para la línea.",
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

// Rechazar formularios incompletos antes de convertir una versión ausente en cero.
function solicitudCierreValida(datos: FormData) {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const version = datos.get("version");
  return uuid.test(String(datos.get("pedidoId") ?? "")) && uuid.test(String(datos.get("clave") ?? ""))
    && typeof version === "string" && /^\d+$/.test(version) && Number.isSafeInteger(Number(version));
}

export async function finalizarPreparacionPedidoAction(_: EstadoFinalizacionPreparacion, datos: FormData): Promise<EstadoFinalizacionPreparacion> {
  if (!solicitudCierreValida(datos)) return { error: "La solicitud no contiene un pedido, clave y versión válidos. Recarga y revisa el pedido." };
  const pedidoId = String(datos.get("pedidoId") ?? "").trim();
  if (!pedidoId) return { error: "No fue posible identificar el pedido." };
  const supabase = await crearClienteSupabaseServidor();
  const { data: sesion } = await supabase.auth.getUser();
  if (!sesion.user) return { error: "Tu sesión expiró. Inicia sesión nuevamente." };
  const { data: pedido } = await supabase.from("pedidos").select("cliente_id,fecha_entrega").eq("id", pedidoId).maybeSingle();
  const { error } = await supabase.rpc("cerrar_preparacion_autorizada", { p_pedido_id: pedidoId, p_version_esperada: Number(datos.get("version")), p_clave: String(datos.get("clave") ?? ""), p_motivo: String(datos.get("motivo") ?? "").trim(), p_autoriza_parcial: datos.get("autorizaParcial") === "si" });
  if (error) return { error: error.code === "PGRST202" ? "Falta instalar el SQL manual de preparación autorizada y resolución sin stock." : mensajesRpc[error.message] ?? "No fue posible finalizar la preparación." };
  revalidatePath("/admin"); revalidatePath("/admin/pedidos");
  revalidatePath("/admin/rutas"); revalidatePath(`/admin/pedidos/${pedidoId}`);
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

export async function guardarPreparacionItemPedido(_: EstadoPreparacionItem, datos: FormData): Promise<EstadoPreparacionItem> {
  const itemPedidoId = String(datos.get("itemPedidoId") ?? "").trim();
  const importeTexto = String(datos.get("importe") ?? "").trim();
  const importe = importeTexto === "" ? null : Number(importeTexto);
  if (importe !== null && (!Number.isSafeInteger(importe) || importe < 0)) return { error: "Ingresa un importe entero en CLP, cero o mayor." };
  const cantidadTexto = String(datos.get("cantidadPreparada") ?? "").trim();
  const cantidadPreparadaFormulario = Number(cantidadTexto);
  const motivo = String(datos.get("motivo") ?? "").trim();
  if (!itemPedidoId) return { error: "No fue posible identificar el producto." };
  if (!cantidadTexto || !Number.isFinite(cantidadPreparadaFormulario) || cantidadPreparadaFormulario < 0) return { error: "Ingresa una cantidad preparada válida." };

  const supabase = await crearClienteSupabaseServidor();
  const { data: sesion } = await supabase.auth.getUser();
  if (!sesion.user) return { error: "Tu sesión expiró. Inicia sesión nuevamente." };

  const { data: item } = await supabase.from("items_pedido").select("pedido_id,cantidad").eq("id", itemPedidoId).maybeSingle();
  const { data: pedido } = item
    ? await supabase.from("pedidos").select("cliente_id,fecha_entrega").eq("id", item.pedido_id).maybeSingle()
    : { data: null };
  const { data, error } = await supabase.rpc("confirmar_producto_preparado", {
    p_item_pedido_id: itemPedidoId,
    p_cantidad: cantidadPreparadaFormulario,
    p_importe: importe,
    p_version_esperada: Number(datos.get("version")),
    p_clave: String(datos.get("clave") ?? ""),
    p_motivo: motivo || "Confirmación explícita de producto",
  });
  if (error) return { error: mensajesRpc[error.message] ?? "No fue posible guardar la preparación." };

  revalidatePath("/admin");
  revalidatePath("/admin/pedidos");
  revalidatePath("/admin/rutas");
  if (pedido?.fecha_entrega) revalidatePath(`/admin/pedidos/entregas/${pedido.fecha_entrega}`);
  if (item?.pedido_id) revalidatePath(`/admin/pedidos/${item.pedido_id}`);
  if (pedido?.cliente_id) revalidatePath(`/admin/clientes/${pedido.cliente_id}`);

  void data;
  return { guardado: true };
}

export async function resolverSinStockAction(_: EstadoFinalizacionPreparacion, datos: FormData): Promise<EstadoFinalizacionPreparacion> {
  if (!solicitudCierreValida(datos)) return { error: "La solicitud no contiene un pedido, clave y versión válidos. Recarga y revisa el pedido." };
  const db = await crearClienteSupabaseServidor();
  const { data: { user } } = await db.auth.getUser();
  const { data: admin, error: permisoError } = await db.rpc("es_admin");
  if (!user || permisoError || admin !== true) return { error: "No tienes permiso para resolver este pedido." };
  const pedidoId = String(datos.get("pedidoId") ?? "");
  const { error } = await db.rpc("resolver_pedido_sin_stock", { p_pedido_id: pedidoId, p_version_esperada: Number(datos.get("version")), p_clave: String(datos.get("clave") ?? ""), p_motivo: String(datos.get("motivo") ?? "").trim(), p_confirmado: datos.get("confirmaSinStock") === "si" });
  if (error) return { error: error.code === "PGRST202" ? "Falta instalar el SQL manual para resolver pedidos sin stock." : mensajesRpc[error.message] ?? "No se pudo confirmar la resolución. Reintenta la misma solicitud o consulta el estado actualizado." };
  for (const path of ["/admin/rutas", "/admin/pedidos", `/admin/pedidos/${pedidoId}`, `/admin/pedidos/${pedidoId}/historial`, "/reparto", "/mi-cuenta/pedidos"]) revalidatePath(path);
  revalidatePath("/admin/pedidos/entregas/[fecha]", "page");
  revalidatePath("/admin");
  revalidatePath(`/mi-cuenta/pedidos/${pedidoId}`);
  revalidatePath(`/pedido/confirmacion/${pedidoId}`);
  return { finalizado: true };
}
