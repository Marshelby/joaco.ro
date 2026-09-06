import "server-only";

import { crearClienteSupabaseServidor } from "@/lib/supabase/server";
import type { ClienteChatAdmin, ConversacionCliente, CursorMensajes, DetalleChatAdmin, InboxAdmin, MensajeConversacion } from "@/types/chat";

type InboxFila = {
  conversacion_id: string;
  cliente_id: string;
  cliente_nombre: string;
  cliente_telefono: string | null;
  cliente_email: string | null;
  cliente_usuario_id: string | null;
  cliente_activo: boolean;
  ultimo_mensaje_preview: string | null;
  ultimo_mensaje_en: string | null;
  ultimo_remitente_tipo: "cliente" | "admin" | null;
  admin_ultimo_leido_en: string | null;
  fecha_actualizacion: string;
  mensajes_no_leidos: number | string;
};

type ConversacionFila = {
  id: string;
  cliente_id: string;
  cliente_ultimo_leido_en: string | null;
  admin_ultimo_leido_en: string | null;
  ultimo_mensaje_en: string | null;
};

type MensajeFila = {
  id: string;
  conversacion_id: string;
  remitente_usuario_id: string;
  remitente_tipo: "cliente" | "admin";
  remitente_nombre_snapshot: string;
  contenido: string;
  fecha_creacion: string;
  pedidos: { id: string; numero_pedido: string } | null;
};

function mapCliente(fila: { id: string; nombre: string; telefono: string | null; email: string | null; usuario_id: string | null; activo: boolean }): ClienteChatAdmin {
  return { id: fila.id, nombre: fila.nombre, telefono: fila.telefono, email: fila.email, usuarioId: fila.usuario_id, activo: fila.activo };
}

function mapConversacion(fila: ConversacionFila): ConversacionCliente {
  return { id: fila.id, clienteId: fila.cliente_id, clienteUltimoLeidoEn: fila.cliente_ultimo_leido_en, adminUltimoLeidoEn: fila.admin_ultimo_leido_en, ultimoMensajeEn: fila.ultimo_mensaje_en };
}

function mapMensaje(fila: MensajeFila): MensajeConversacion {
  return {
    id: fila.id,
    conversacionId: fila.conversacion_id,
    remitenteUsuarioId: fila.remitente_usuario_id,
    remitenteTipo: fila.remitente_tipo,
    remitenteNombreSnapshot: fila.remitente_nombre_snapshot,
    contenido: fila.contenido,
    pedido: fila.pedidos ? { id: fila.pedidos.id, numeroPedido: fila.pedidos.numero_pedido } : null,
    fechaCreacion: fila.fecha_creacion,
  };
}

export async function obtenerInboxChatAdmin(input?: { soloNoLeidos?: boolean; cursor?: { ultimoMensajeEn: string; conversacionId: string } }): Promise<InboxAdmin> {
  const supabase = await crearClienteSupabaseServidor();
  const [{ data, error }, { data: resumen, error: resumenError }] = await Promise.all([
    supabase.rpc("listar_conversaciones_chat_administrativas", {
      p_solo_no_leidos: input?.soloNoLeidos ?? false,
      p_cursor_ultimo_mensaje_en: input?.cursor?.ultimoMensajeEn ?? null,
      p_cursor_conversacion_id: input?.cursor?.conversacionId ?? null,
      p_limite: 31,
    }),
    supabase.rpc("obtener_resumen_chat_administrativo"),
  ]);
  if (error || resumenError) throw new Error("No fue posible cargar los mensajes administrativos.");

  const filas = ((data as InboxFila[] | null) ?? []);
  const tieneSiguientePagina = filas.length > 30;
  const conversaciones = filas.slice(0, 30).map((fila) => ({
    id: fila.conversacion_id,
    cliente: { id: fila.cliente_id, nombre: fila.cliente_nombre, telefono: fila.cliente_telefono, email: fila.cliente_email, usuarioId: fila.cliente_usuario_id, activo: fila.cliente_activo },
    ultimoMensajePreview: fila.ultimo_mensaje_preview,
    ultimoMensajeEn: fila.ultimo_mensaje_en,
    ultimoRemitenteTipo: fila.ultimo_remitente_tipo,
    adminUltimoLeidoEn: fila.admin_ultimo_leido_en,
    fechaActualizacion: fila.fecha_actualizacion,
    mensajesNoLeidos: Number(fila.mensajes_no_leidos),
  }));
  const ultimo = conversaciones.at(-1);
  const filaResumen = (resumen as Array<{ mensajes_no_leidos: number | string }> | null)?.[0];
  return { conversaciones, siguienteCursor: tieneSiguientePagina && ultimo?.ultimoMensajeEn ? { ultimoMensajeEn: ultimo.ultimoMensajeEn, conversacionId: ultimo.id } : null, mensajesNoLeidos: Number(filaResumen?.mensajes_no_leidos ?? 0) };
}

export async function obtenerResumenChatAdmin(): Promise<{ mensajesNoLeidos: number }> {
  try {
    const supabase = await crearClienteSupabaseServidor();
    const { data, error } = await supabase.rpc("obtener_resumen_chat_administrativo");
    if (error) return { mensajesNoLeidos: 0 };
    const fila = (data as Array<{ mensajes_no_leidos: number | string }> | null)?.[0];
    return { mensajesNoLeidos: Number(fila?.mensajes_no_leidos ?? 0) };
  } catch {
    return { mensajesNoLeidos: 0 };
  }
}

export async function obtenerDetalleChatAdmin(clienteId: string, cursor?: CursorMensajes): Promise<DetalleChatAdmin | null> {
  const supabase = await crearClienteSupabaseServidor();
  const { data: clienteFila, error: clienteError } = await supabase
    .from("clientes")
    .select("id,nombre,telefono,email,usuario_id,activo")
    .eq("id", clienteId)
    .maybeSingle();
  if (clienteError) throw new Error("No fue posible cargar el cliente.");
  if (!clienteFila) return null;

  const { data: conversacionFila, error: conversacionError } = await supabase
    .from("conversaciones_cliente")
    .select("id,cliente_id,cliente_ultimo_leido_en,admin_ultimo_leido_en,ultimo_mensaje_en")
    .eq("cliente_id", clienteId)
    .maybeSingle();
  if (conversacionError) throw new Error("No fue posible cargar la conversación.");
  if (!conversacionFila) return { cliente: mapCliente(clienteFila), conversacion: null, mensajes: [], tieneMensajesAnteriores: false };

  const conversacion = mapConversacion(conversacionFila as unknown as ConversacionFila);
  let consulta = supabase
    .from("mensajes_conversacion")
    .select("id,conversacion_id,remitente_usuario_id,remitente_tipo,remitente_nombre_snapshot,contenido,fecha_creacion,pedidos(id,numero_pedido)")
    .eq("conversacion_id", conversacion.id)
    .order("fecha_creacion", { ascending: false })
    .order("id", { ascending: false })
    .limit(51);
  if (cursor) consulta = consulta.or(`fecha_creacion.lt.${cursor.fechaCreacion},and(fecha_creacion.eq.${cursor.fechaCreacion},id.lt.${cursor.id})`);

  const { data: mensajesFila, error: mensajesError } = await consulta;
  if (mensajesError) throw new Error("No fue posible cargar los mensajes.");
  const filas = (mensajesFila as unknown as MensajeFila[] | null) ?? [];
  return { cliente: mapCliente(clienteFila), conversacion, mensajes: filas.slice(0, 50).map(mapMensaje).reverse(), tieneMensajesAnteriores: filas.length > 50 };
}
