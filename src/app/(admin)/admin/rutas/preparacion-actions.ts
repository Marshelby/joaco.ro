"use server";

import { revalidatePath } from "next/cache";
import { crearClienteSupabaseServidor } from "@/lib/supabase/server";

export async function guardarAvancePreparacion(datos: FormData): Promise<{ error?: string; guardado?: boolean }> {
  const cantidadTexto = String(datos.get("cantidadPreparada") ?? "").trim();
  const cantidad = Number(cantidadTexto);
  const version = Number(datos.get("version"));
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
  return { guardado: true };
}
