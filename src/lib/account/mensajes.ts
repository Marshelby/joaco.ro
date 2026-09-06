import "server-only";

import { obtenerClienteActual } from "@/lib/account/identity";
import { crearClienteSupabaseServidor } from "@/lib/supabase/server";
import type { ConversacionCliente, CursorMensajes, MensajeConversacion, MensajesCuenta } from "@/types/chat";

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

function mapConversacion(fila: ConversacionFila): ConversacionCliente {
  return {
    id: fila.id,
    clienteId: fila.cliente_id,
    clienteUltimoLeidoEn: fila.cliente_ultimo_leido_en,
    adminUltimoLeidoEn: fila.admin_ultimo_leido_en,
    ultimoMensajeEn: fila.ultimo_mensaje_en,
  };
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

async function obtenerConversacionCliente(clienteId: string) {
  const supabase = await crearClienteSupabaseServidor();
  const { data, error } = await supabase
    .from("conversaciones_cliente")
    .select("id,cliente_id,cliente_ultimo_leido_en,admin_ultimo_leido_en,ultimo_mensaje_en")
    .eq("cliente_id", clienteId)
    .maybeSingle();

  if (error) throw new Error("No fue posible cargar tus mensajes.");
  return data as unknown as ConversacionFila | null;
}

export async function obtenerMensajesCuenta(cursor?: CursorMensajes): Promise<MensajesCuenta | null> {
  const cliente = await obtenerClienteActual();
  if (!cliente) return null;

  const conversacionFila = await obtenerConversacionCliente(cliente.id);
  if (!conversacionFila) {
    return { conversacion: null, mensajes: [], tieneMensajesAnteriores: false, mensajesAdminNoLeidos: 0 };
  }

  const conversacion = mapConversacion(conversacionFila);
  const supabase = await crearClienteSupabaseServidor();
  let consulta = supabase
    .from("mensajes_conversacion")
    .select("id,conversacion_id,remitente_usuario_id,remitente_tipo,remitente_nombre_snapshot,contenido,fecha_creacion,pedidos(id,numero_pedido)")
    .eq("conversacion_id", conversacion.id)
    .order("fecha_creacion", { ascending: false })
    .order("id", { ascending: false })
    .limit(51);

  if (cursor) {
    consulta = consulta.or(`fecha_creacion.lt.${cursor.fechaCreacion},and(fecha_creacion.eq.${cursor.fechaCreacion},id.lt.${cursor.id})`);
  }

  const [mensajesResult, noLeidosResult] = await Promise.all([
    consulta,
    conversacion.clienteUltimoLeidoEn
      ? supabase
        .from("mensajes_conversacion")
        .select("*", { count: "exact", head: true })
        .eq("conversacion_id", conversacion.id)
        .eq("remitente_tipo", "admin")
        .gt("fecha_creacion", conversacion.clienteUltimoLeidoEn)
      : supabase
        .from("mensajes_conversacion")
        .select("*", { count: "exact", head: true })
        .eq("conversacion_id", conversacion.id)
        .eq("remitente_tipo", "admin"),
  ]);

  if (mensajesResult.error || noLeidosResult.error) throw new Error("No fue posible cargar tus mensajes.");

  const filas = (mensajesResult.data as unknown as MensajeFila[] | null) ?? [];
  const tieneMensajesAnteriores = filas.length > 50;
  const mensajes = filas.slice(0, 50).map(mapMensaje).reverse();

  return {
    conversacion,
    mensajes,
    tieneMensajesAnteriores,
    mensajesAdminNoLeidos: noLeidosResult.count ?? 0,
  };
}

export async function obtenerResumenMensajesCuenta(): Promise<{ mensajesAdminNoLeidos: number }> {
  try {
    const cliente = await obtenerClienteActual();
    if (!cliente) return { mensajesAdminNoLeidos: 0 };

    const conversacion = await obtenerConversacionCliente(cliente.id);
    if (!conversacion) return { mensajesAdminNoLeidos: 0 };

    const supabase = await crearClienteSupabaseServidor();
    let consulta = supabase
      .from("mensajes_conversacion")
      .select("*", { count: "exact", head: true })
      .eq("conversacion_id", conversacion.id)
      .eq("remitente_tipo", "admin");

    if (conversacion.cliente_ultimo_leido_en) {
      consulta = consulta.gt("fecha_creacion", conversacion.cliente_ultimo_leido_en);
    }

    const { count, error } = await consulta;
    if (error) return { mensajesAdminNoLeidos: 0 };
    return { mensajesAdminNoLeidos: count ?? 0 };
  } catch {
    // El badge es accesorio: un error de lectura no debe bloquear Mi Cuenta.
    return { mensajesAdminNoLeidos: 0 };
  }
}
