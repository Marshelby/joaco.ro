"use server";

import { revalidatePath } from "next/cache";

import { crearClienteSupabaseServidor } from "@/lib/supabase/server";

export type EstadoCrearPedido = {
  error?: string;
  pedidoId?: string;
  numeroPedido?: string;
};

const mensajesRpc: Record<string, string> = {
  NO_AUTORIZADO: "No tienes permisos para confirmar este pedido.",
  CLIENTE_INVALIDO: "Tu cuenta de cliente no está habilitada para realizar pedidos.",
  DIRECCION_INVALIDA: "La dirección seleccionada ya no está disponible. Revisa tu pedido.",
  DIRECCION_REQUERIDA: "Selecciona una dirección de entrega para confirmar el pedido.",
  DIRECCION_SIN_UBICACION: "Completa la ubicación de esta dirección antes de confirmar el pedido.",
  DIRECCION_SIN_ZONA_VALIDA: "Selecciona una zona de entrega disponible antes de confirmar el pedido.",
  ITEMS_REQUERIDOS: "Tu carrito no contiene productos válidos para confirmar.",
  ITEM_INVALIDO: "Uno de los productos del carrito no es válido. Revisa tu pedido.",
  PRESENTACION_INVALIDA: "Uno de los productos del carrito ya no es válido. Revisa tu pedido.",
  PRESENTACION_NO_DISPONIBLE: "Uno de los productos de tu carrito ya no está disponible. Revisa tu pedido e inténtalo nuevamente.",
  PRESENTACION_DUPLICADA: "El carrito contiene una presentación duplicada. Revisa tu pedido.",
  CANTIDAD_INVALIDA: "Una de las cantidades del carrito ya no es válida. Revisa tu pedido.",
  CLAVE_IDEMPOTENCIA_REQUERIDA: "No fue posible preparar el intento de pedido. Intenta nuevamente.",
  CLAVE_IDEMPOTENCIA_EN_USO: "Este intento de pedido ya está asociado a otra cuenta. Intenta nuevamente.",
};

function obtenerItems(datos: FormData) {
  const texto = String(datos.get("items") ?? "");
  try {
    const valor: unknown = JSON.parse(texto);
    if (!Array.isArray(valor) || valor.length === 0) return null;
    return valor;
  } catch {
    return null;
  }
}

export async function crearPedidoCheckout(_: EstadoCrearPedido, datos: FormData): Promise<EstadoCrearPedido> {
  const items = obtenerItems(datos);
  const claveIdempotencia = String(datos.get("claveIdempotencia") ?? "").trim();
  const direccionClienteId = String(datos.get("direccionClienteId") ?? "").trim() || null;
  const observacion = String(datos.get("observacion") ?? "").trim() || null;

  if (!items || !claveIdempotencia) return { error: "No fue posible preparar el pedido. Revisa el carrito e inténtalo nuevamente." };
  if (!direccionClienteId) return { error: "Selecciona una dirección con ubicación marcada para confirmar el pedido." };

  const supabase = await crearClienteSupabaseServidor();
  const { data: sesion } = await supabase.auth.getUser();
  if (!sesion.user) return { error: "Inicia sesión con tu cuenta de cliente para confirmar el pedido." };

  const { data: cliente, error: errorCliente } = await supabase
    .from("clientes")
    .select("id")
    .eq("usuario_id", sesion.user.id)
    .eq("activo", true)
    .maybeSingle();

  if (errorCliente || !cliente) return { error: "No tienes una cuenta de cliente habilitada para realizar pedidos." };

  const { data: direccion, error: errorDireccion } = await supabase
    .from("direcciones_cliente")
    .select("id,latitud,longitud")
    .eq("id", direccionClienteId)
    .eq("cliente_id", cliente.id)
    .eq("activa", true)
    .maybeSingle();

  if (errorDireccion || !direccion || direccion.latitud === null || direccion.longitud === null) {
    return { error: "Completa la ubicación de esta dirección antes de confirmar el pedido." };
  }

  const { data, error } = await supabase.rpc("crear_pedido_desde_carrito", {
    p_cliente_id: cliente.id,
    p_direccion_cliente_id: direccionClienteId,
    p_items: items,
    p_observacion: observacion,
    p_clave_idempotencia: claveIdempotencia,
  });

  if (error) return { error: mensajesRpc[error.message] ?? "No fue posible confirmar el pedido. Conservamos tu carrito para que puedas intentarlo nuevamente." };

  const pedido = Array.isArray(data) ? data[0] : data;
  if (!pedido?.pedido_id || !pedido?.numero_pedido) return { error: "El pedido fue procesado, pero no pudimos confirmar su resultado. Intenta nuevamente con el mismo pedido." };

  revalidatePath("/admin");
  revalidatePath("/admin/pedidos");
  revalidatePath(`/admin/pedidos/${pedido.pedido_id}`);
  revalidatePath(`/pedido/confirmacion/${pedido.pedido_id}`);

  return { pedidoId: pedido.pedido_id, numeroPedido: pedido.numero_pedido };
}
