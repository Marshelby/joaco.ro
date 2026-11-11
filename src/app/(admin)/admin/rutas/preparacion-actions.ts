"use server";

import { revalidatePath } from "next/cache";
import { crearClienteSupabaseServidor } from "@/lib/supabase/server";

export async function guardarAvancePreparacion(datos: FormData): Promise<{ error?: string; guardado?: boolean }> {
  const cantidadTexto = String(datos.get("cantidadPreparada") ?? "").trim();
  const cantidad = Number(cantidadTexto);
  const versionTexto = String(datos.get("version") ?? "");
  const version = /^\d+$/.test(versionTexto) ? Number(versionTexto) : NaN;
  const itemId = String(datos.get("itemPedidoId") ?? "");
  const clave = String(datos.get("clave") ?? "");
  if (!cantidadTexto || !Number.isFinite(cantidad) || cantidad < 0 || cantidad >= 1e9 ||
      !Number.isSafeInteger(version) || version < 0 || !itemId || !clave) {
    return { error: "Revisa la cantidad cargada y recarga el pedido si es necesario." };
  }
  const supabase = await crearClienteSupabaseServidor();
  const { data: sesion } = await supabase.auth.getUser();
  if (!sesion.user) return { error: "Tu sesión expiró. Inicia sesión nuevamente." };
  const { data: item, error: errorItem } = await supabase.from("items_pedido").select("pedido_id").eq("id", itemId).single();
  if (errorItem || !item) return { error: "No encontramos el producto." };
  const { data: pedido } = await supabase.from("pedidos").select("estado").eq("id", item.pedido_id).single();
  if (pedido?.estado === "confirmado") {
    const { error } = await supabase.rpc("marcar_pedido_preparando_administrativo", { p_pedido_id: item.pedido_id });
    if (error) return { error: "No fue posible iniciar la preparación. Revisa la fecha y tus permisos." };
  }
  // La RPC verifica el permiso administrativo y todas las reglas bajo locks.
  const { error } = await supabase.rpc("guardar_avance_producto_preparado", {
    p_item_pedido_id: itemId, p_cantidad: cantidad,
    p_version_esperada: version, p_clave: clave,
  });
  if (error) {
    const mensajes: Record<string, string> = {
      NO_AUTORIZADO: "No tienes permisos para preparar pedidos.",
      VERSION_OPERATIVA_CONFLICTO: "Otro cambio actualizó el pedido. Recarga y revisa las cantidades antes de continuar.",
      CLAVE_IDEMPOTENCIA_EN_USO: "La solicitud cambió. Recarga y revisa el pedido.",
      PREPARACION_FECHA_NO_HABILITADA: "Solo puedes preparar pedidos con entrega hoy en America/Santiago.",
      ESTADO_PEDIDO_INVALIDO: "El pedido debe estar en preparación y sin finalizar.",
      CANTIDAD_PREPARADA_DEBE_SER_ENTERA: "Esta presentación requiere una cantidad entera.",
      CANTIDAD_PREPARADA_INVALIDA: "Ingresa una cantidad válida, cero o mayor, con hasta tres decimales.",
    };
    return { error: mensajes[error.message] ?? "No fue posible guardar el avance." };
  }
  revalidatePath("/admin/rutas");
  revalidatePath("/admin/pedidos");
  revalidatePath(`/admin/pedidos/${item.pedido_id}`);
  revalidatePath("/admin/pedidos/entregas/[fecha]", "page");
  return { guardado: true };
}

export async function confirmarPreparacionRuta(datos: FormData): Promise<{ error?: string; confirmado?: boolean }> {
  const versionTexto = String(datos.get("version") ?? "");
  const version = /^\d+$/.test(versionTexto) ? Number(versionTexto) : NaN;
  let pedidos: unknown;
  try { pedidos = JSON.parse(String(datos.get("pedidos"))); } catch { return { error: "Resumen inválido. Recarga la ruta." }; }
  if (!Number.isSafeInteger(version) || version < 0 || !Array.isArray(pedidos)) return { error: "Recarga el resumen de la ruta." };
  const supabase = await crearClienteSupabaseServidor();
  const { data: sesion } = await supabase.auth.getUser();
  if (!sesion.user) return { error: "Tu sesión expiró. Inicia sesión nuevamente." };
  const { data, error } = await supabase.rpc("confirmar_preparacion_ruta", { p_solicitud: {
    accion: "confirmar_preparacion", fecha: datos.get("fecha") ? String(datos.get("fecha")) : null, ruta: String(datos.get("ruta")) || null, version, clave: String(datos.get("clave")),
    pedidos, motivo: String(datos.get("motivo") ?? ""),
  } });
  if (error) {
    const mensajes: Record<string, string> = {
      PRODUCTOS_PENDIENTES: "Guarda todas las cantidades. Los productos sin trabajar no equivalen a cero.",
      PEDIDO_VACIO_REQUIERE_REVISION: "La ruta contiene un pedido vacío que requiere revisión.",
      VERSION_RUTA_CONFLICTO: "La ruta cambió. Vuelve a cantidades y revisa el nuevo resumen.",
      VERSION_OPERATIVA_CONFLICTO: "Un pedido cambió. Vuelve a cantidades y revisa el nuevo resumen.",
      SIN_STOCK_NO_CONFIRMADO: "Declara expresamente los pedidos en los que no se cargó nada.",
      SIN_STOCK_HISTORICO_INCOMPATIBLE: "Un pedido sin stock tiene contabilidad o historial incompatible. Requiere revisión administrativa. No se confirmó la ruta.",
      REGIMEN_CONTABLE_NO_COMPATIBLE: "Hay contabilidad histórica incompatible. Requiere revisión administrativa.",
      ESTADO_PEDIDO_INVALIDO: "Hay un pedido con estado o historial incompatible. Requiere revisión administrativa. No se confirmó la ruta.",
      MOTIVO_REQUERIDO: "El resumen no contiene el registro de aceptación de diferencias. Recarga la ruta.",
      TOTAL_ADMINISTRATIVO_SIN_REGLA_PARA_CANTIDAD_PREPARADA: "Una línea tiene un total cerrado sin regla para la cantidad cargada. Requiere una regla comercial autorizada; no se confirmó la ruta.",
      TOTAL_FINAL_INVALIDO: "El importe calculado excede el rango contable permitido. Requiere revisión; no se confirmó la ruta.",
      IMPORTE_CALCULADO_CONFLICTO: "Cambió el importe calculado. Recarga el resumen.",
      REFERENCIAS_OPERATIVAS_INCOMPATIBLES: "Hay asignaciones contradictorias entre rutas y cargas. Requieren revisión administrativa.",
      PREPARACION_FECHA_NO_HABILITADA: "La fecha de entrega debe ser hoy en America/Santiago.",
      CLAVE_IDEMPOTENCIA_EN_USO: "La clave pertenece a otra solicitud. Consulta el estado actualizado.",
      NO_AUTORIZADO: "No tienes permisos administrativos.",
    };
    return { error: mensajes[error.message] ?? "No se confirmó la ruta. La operación se revierte completa si falla. Revisa la instalación del SQL de confirmación única y recarga ante cambios concurrentes." };
  }
  if (data?.ok !== true || data?.preparacion_confirmada !== true) return { error: "No se pudo verificar la confirmación. Consulta el estado actualizado de la ruta." };
  revalidatePath("/admin/rutas"); revalidatePath("/admin/pedidos"); revalidatePath("/reparto");
  revalidatePath("/admin/pedidos/[id]", "page");
  revalidatePath("/admin/pedidos/[id]/historial", "page");
  revalidatePath("/admin/pedidos/entregas/[fecha]", "page");
  return { confirmado: true };
}
