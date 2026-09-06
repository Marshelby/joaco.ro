"use server";

import { revalidatePath } from "next/cache";

import { obtenerIdentidadActual } from "@/lib/account/identity";
import { obtenerDetalleChatAdmin } from "@/lib/admin/mensajes";
import { crearClienteSupabaseServidor } from "@/lib/supabase/server";
import type { CursorMensajes, MensajeConversacion } from "@/types/chat";

type ResultadoEnviarMensajeAdmin =
  | { ok: true; mensaje: MensajeConversacion }
  | { ok: false; error: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const errores: Record<string, string> = {
  CHAT_NO_AUTENTICADO: "Tu sesión expiró. Vuelve a iniciar sesión.",
  CHAT_ACTOR_INVALIDO: "No fue posible validar tu cuenta administrativa.",
  CHAT_CLIENTE_REQUERIDO: "No fue posible identificar el cliente.",
  CHAT_CLIENTE_INEXISTENTE: "No encontramos el cliente.",
  CHAT_CLIENTE_INACTIVO: "No es posible iniciar nuevos mensajes con un cliente inactivo.",
  CHAT_MENSAJE_VACIO: "Escribe un mensaje antes de enviarlo.",
  CHAT_MENSAJE_DEMASIADO_LARGO: "El mensaje puede tener hasta 2.000 caracteres.",
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
  fecha_creacion: string;
};

async function esAdminActual() {
  const identidad = await obtenerIdentidadActual();
  return identidad?.rol === "admin";
}

export async function enviarMensajeAdmin(input: { clienteId: string; contenido: string; claveIdempotencia: string }): Promise<ResultadoEnviarMensajeAdmin> {
  if (!await esAdminActual()) return { ok: false, error: "No tienes permiso para enviar mensajes." };
  const contenido = input.contenido.trim();
  if (!UUID_RE.test(input.clienteId)) return { ok: false, error: errores.CHAT_CLIENTE_REQUERIDO };
  if (!UUID_RE.test(input.claveIdempotencia)) return { ok: false, error: "No fue posible preparar el envío. Inténtalo nuevamente." };
  if (!contenido) return { ok: false, error: errores.CHAT_MENSAJE_VACIO };
  if (contenido.length > 2000) return { ok: false, error: errores.CHAT_MENSAJE_DEMASIADO_LARGO };

  const supabase = await crearClienteSupabaseServidor();
  const { data, error } = await supabase.rpc("enviar_mensaje_conversacion", {
    p_cliente_id: input.clienteId,
    p_contenido: contenido,
    p_pedido_id: null,
    p_clave_idempotencia: input.claveIdempotencia,
  });
  if (error) return { ok: false, error: errores[error.message] ?? "No fue posible enviar el mensaje. Inténtalo nuevamente." };

  const fila = (data as MensajeRpcFila[] | null)?.[0];
  if (!fila) return { ok: false, error: "No fue posible confirmar el envío." };
  revalidatePath("/admin/mensajes");
  revalidatePath(`/admin/mensajes/${input.clienteId}`);
  return { ok: true, mensaje: { id: fila.mensaje_id, conversacionId: fila.conversacion_id, remitenteUsuarioId: fila.remitente_usuario_id, remitenteTipo: fila.remitente_tipo, remitenteNombreSnapshot: fila.remitente_nombre_snapshot, contenido: fila.contenido, pedido: null, fechaCreacion: fila.fecha_creacion } };
}

export async function cargarMensajesAnterioresAdmin(clienteId: string, cursor: CursorMensajes) {
  if (!await esAdminActual()) return { mensajes: [], tieneMensajesAnteriores: false };
  const detalle = await obtenerDetalleChatAdmin(clienteId, cursor);
  if (!detalle?.conversacion) return { mensajes: [], tieneMensajesAnteriores: false };
  return { mensajes: detalle.mensajes, tieneMensajesAnteriores: detalle.tieneMensajesAnteriores };
}

export async function marcarConversacionLeidaAdmin(clienteId: string) {
  if (!await esAdminActual() || !UUID_RE.test(clienteId)) return { ok: false };
  const supabase = await crearClienteSupabaseServidor();
  const { error } = await supabase.rpc("marcar_conversacion_leida", { p_cliente_id: clienteId });
  if (error) return { ok: false };
  revalidatePath("/admin/mensajes");
  revalidatePath(`/admin/mensajes/${clienteId}`);
  return { ok: true };
}
