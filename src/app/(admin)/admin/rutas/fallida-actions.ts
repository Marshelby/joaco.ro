"use server";

import { revalidatePath } from "next/cache";
import { crearClienteSupabaseServidor } from "@/lib/supabase/server";

export type SolicitudEntregaFallida = {
  p_pedido_id: string;
  p_version_esperada: number;
  p_clave: string;
  p_motivo: string;
  p_observaciones: string | null;
};
const motivos = ["Cliente ausente", "Cliente rechazó pedido", "Dirección incorrecta", "Problema de acceso", "Otro"];
const uuid = (v: unknown) => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

export async function registrarEntregaFallida(s: SolicitudEntregaFallida, confirmacion: boolean): Promise<{ exito?: boolean; error?: string }> {
  if (confirmacion !== true || !s || !uuid(s.p_pedido_id) || !uuid(s.p_clave) ||
    !Number.isSafeInteger(s.p_version_esperada) || s.p_version_esperada < 0 || s.p_version_esperada >= Number.MAX_SAFE_INTEGER ||
    !motivos.includes(s.p_motivo) || (s.p_observaciones !== null && typeof s.p_observaciones !== "string") ||
    (s.p_observaciones !== null && s.p_observaciones.length > 2000) ||
    (s.p_motivo === "Otro" && !s.p_observaciones?.trim())) {
    return { error: "Selecciona un motivo, completa la descripción de Otro y confirma explícitamente. Máximo 2000 caracteres en total." };
  }
  try {
    const db = await crearClienteSupabaseServidor();
    const { data: sesion, error: errorSesion } = await db.auth.getUser();
    if (errorSesion || !sesion.user) return { error: "Tu sesión expiró. Inicia sesión y reintenta con la misma solicitud." };
    const { data: admin, error: errorAdmin } = await db.rpc("es_admin");
    if (errorAdmin || admin !== true) return { error: "No tienes permisos para registrar entregas fallidas." };
    // No comprobar estado/versión por separado: la RPC resuelve primero el reintento
    // y luego valida ambos bajo lock, incluso si la primera respuesta se perdió.
    const { data, error } = await db.rpc("registrar_entrega_fallida", {
      p_pedido_id: s.p_pedido_id, p_version_esperada: s.p_version_esperada,
      p_clave: s.p_clave, p_motivo: s.p_motivo, p_observaciones: s.p_observaciones,
    });
    if (error) {
      const mensajes: Record<string, string> = {
        RUTA_CERRADA: "La ruta ya está cerrada. Actualiza para consultar el resultado.",
        NO_AUTORIZADO: "No tienes permisos para registrar entregas fallidas.",
        VERSION_OPERATIVA_CONFLICTO: "El pedido cambió. Cierra y actualiza la ruta antes de revisarlo nuevamente.",
        CLAVE_IDEMPOTENCIA_EN_USO: "La clave corresponde a otra solicitud. Cierra y revisa el estado del pedido.",
        ESTADO_PEDIDO_INVALIDO: "El pedido ya no está en reparto o ya tiene una entrega registrada. Actualiza la ruta.",
        PEDIDO_NO_ENCONTRADO: "El pedido no está disponible.",
        MOTIVO_ENTREGA_FALLIDA_INVALIDO: "Selecciona un motivo válido.",
        DESCRIPCION_ENTREGA_FALLIDA_REQUERIDA: "Describe el motivo Otro.",
        OBSERVACIONES_DEMASIADO_LARGAS: "La descripción y las observaciones no pueden superar 2000 caracteres en total.",
      };
      return { error: mensajes[error.message] ?? "No se pudo registrar la entrega fallida. Reintenta con la misma solicitud." };
    }
    if (data?.resultado?.estado !== "entrega_fallida" || data.resultado.pedido_id !== s.p_pedido_id) {
      return { error: "No se pudo verificar la respuesta. Reintenta con la misma solicitud para evitar duplicados." };
    }
  } catch {
    return { error: "No se pudo verificar la respuesta. Reintenta: se conserva la clave y el contenido original para evitar duplicados." };
  }
  for (const ruta of ["/admin/rutas", "/admin/pedidos", "/mi-cuenta/pedidos", "/reparto"]) {
    try { revalidatePath(ruta, "layout"); } catch { /* El cliente también actualiza la ruta. */ }
  }
  return { exito: true };
}
