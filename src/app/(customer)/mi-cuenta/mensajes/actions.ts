"use server";

import { revalidatePath } from "next/cache";

import { obtenerClienteActual } from "@/lib/account/identity";
import { obtenerMensajesCuenta } from "@/lib/account/mensajes";
import { crearClienteSupabaseServidor } from "@/lib/supabase/server";
import type { CursorMensajes, MensajeConversacion } from "@/types/chat";

type ResultadoEnviarMensaje =
  | { ok: true; mensaje: MensajeConversacion }
  | { ok: false; error: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const errores: Record<string, string> = {
  CHAT_NO_AUTENTICADO: "Tu sesión expiró. Vuelve a iniciar sesión para enviar un mensaje.",
  CHAT_ACTOR_INVALIDO: "No fue posible validar tu cuenta para enviar mensajes.",
  CHAT_CLIENTE_NO_DISPONIBLE: "No fue posible validar tu cuenta de cliente.",
  CHAT_CLIENTE_DESTINO_INVALIDO: "No fue posible enviar el mensaje.",
  CHAT_MENSAJE_VACIO: "Escribe un mensaje antes de enviarlo.",
  CHAT_MENSAJE_DEMASIADO_LARGO: "Tu mensaje puede tener hasta 2.000 caracteres.",
  CHAT_PEDIDO_INVALIDO: "El pedido relacionado no es válido.",
  CHAT_LIMITE_DE_MENSAJES: "Has enviado varios mensajes seguidos. Espera un momento e inténtalo nuevamente.",
};

type MensajeRpcFila = {
  mensaje_id: string;
  conversacion_id: string;
  remitente_usuario_id: string;
  remitente_tipo: "cliente" | "admin";
  remitente_nombre_snapshot: string;
  contenido: string;
  pedido_id: string | null;
  fecha_creacion: string;
};

export async function enviarMensajeCliente(input: {
  contenido: string;
  pedidoId?: string | null;
  claveIdempotencia: string;
}): Promise<ResultadoEnviarMensaje> {
  const contenido = input.contenido.trim();
  if (!contenido) return { ok: false, error: errores.CHAT_MENSAJE_VACIO };
  if (contenido.length > 2000) return { ok: false, error: errores.CHAT_MENSAJE_DEMASIADO_LARGO };
  if (!UUID_RE.test(input.claveIdempotencia)) return { ok: false, error: "No fue posible preparar el envío. Inténtalo nuevamente." };
  if (input.pedidoId && !UUID_RE.test(input.pedidoId)) return { ok: false, error: errores.CHAT_PEDIDO_INVALIDO };

  const cliente = await obtenerClienteActual();
  if (!cliente) return { ok: false, error: errores.CHAT_CLIENTE_NO_DISPONIBLE };

  const supabase = await crearClienteSupabaseServidor();
  const { data, error } = await supabase.rpc("enviar_mensaje_conversacion", {
    p_cliente_id: cliente.id,
    p_contenido: contenido,
    p_pedido_id: input.pedidoId ?? null,
    p_clave_idempotencia: input.claveIdempotencia,
  });

  if (error) return { ok: false, error: errores[error.message] ?? "No fue posible enviar el mensaje. Inténtalo nuevamente." };
  const fila = (data as MensajeRpcFila[] | null)?.[0];
  if (!fila) return { ok: false, error: "No fue posible confirmar el envío." };

  revalidatePath("/mi-cuenta/mensajes");
  return {
    ok: true,
    mensaje: {
      id: fila.mensaje_id,
      conversacionId: fila.conversacion_id,
      remitenteUsuarioId: fila.remitente_usuario_id,
      remitenteTipo: fila.remitente_tipo,
      remitenteNombreSnapshot: fila.remitente_nombre_snapshot,
      contenido: fila.contenido,
      pedido: null,
      fechaCreacion: fila.fecha_creacion,
    },
  };
}

export async function cargarMensajesAnterioresCliente(cursor: CursorMensajes) {
  const datos = await obtenerMensajesCuenta(cursor);
  if (!datos?.conversacion) return { mensajes: [], tieneMensajesAnteriores: false };
  return { mensajes: datos.mensajes, tieneMensajesAnteriores: datos.tieneMensajesAnteriores };
}

export async function marcarConversacionLeidaCliente() {
  const cliente = await obtenerClienteActual();
  if (!cliente) return;

  const supabase = await crearClienteSupabaseServidor();
  await supabase.rpc("marcar_conversacion_leida", { p_cliente_id: cliente.id });
  revalidatePath("/mi-cuenta/mensajes");
}
