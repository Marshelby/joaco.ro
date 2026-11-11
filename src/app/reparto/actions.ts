"use server";
import { revalidatePath } from "next/cache";
import { exigirRepartidor } from "@/lib/reparto/server";

export type SolicitudReparto = {
  fecha: string; asignacion: number; accion: "entregar" | "fallida" | "revisar_cierre" | "cerrar";
  pedido?: string; version?: number; clave?: string; motivo?: string; observaciones?: string; huella?: string;
};
export type RespuestaReparto = { error?: string; ok?: boolean; cierre?: { version: number; huella: string; estado: string } };
const uuid = (s: unknown) => typeof s === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
export async function operarReparto(s: SolicitudReparto): Promise<RespuestaReparto> {
  const db = await exigirRepartidor();
  if (!s || (typeof s.fecha !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s.fecha) || !Number.isFinite(Date.parse(s.fecha)) || new Date(s.fecha).toISOString().slice(0, 10) !== s.fecha) || !Number.isSafeInteger(s.asignacion) || s.asignacion < 1 ||
    !["entregar", "fallida", "revisar_cierre", "cerrar"].includes(s.accion) ||
    (s.accion !== "revisar_cierre" && (!uuid(s.clave) || !Number.isSafeInteger(s.version) || (s.version! < 0 || s.version! >= Number.MAX_SAFE_INTEGER))) ||
    (["entregar", "fallida"].includes(s.accion) && !uuid(s.pedido)) ||
    (s.accion === "fallida" && (!["Cliente ausente", "Cliente rechazó pedido", "Dirección incorrecta", "Problema de acceso", "Otro"].includes(s.motivo ?? "") || typeof s.observaciones !== "string" || s.observaciones.length > 1900 || (s.motivo === "Otro" && !s.observaciones.trim()))) ||
    (s.accion === "cerrar" && (typeof s.huella !== "string" || !/^[a-f0-9]{64}$/.test(s.huella)))) return { error: "Solicitud inválida. Actualiza la ruta." };
  try {
    const { data, error } = await db.rpc("operar_mi_reparto", {
      p_fecha: s.fecha, p_asignacion: s.asignacion, p_accion: s.accion, p_pedido: s.pedido ?? null,
      p_version: s.version ?? null, p_clave: s.clave ?? null, p_motivo: s.motivo ?? null,
      p_observaciones: s.observaciones ?? null, p_huella: s.huella ?? null,
    });
    if (error) {
      const mensajes: Record<string, string> = {
        NO_AUTORIZADO: "Tu permiso ya no está disponible. Actualiza la página.",
        ASIGNACION_CAMBIO: "La asignación cambió. Actualiza la ruta.",
        PEDIDOS_PENDIENTES: "Resuelve todos los pedidos antes de terminar.",
        VERSION_OPERATIVA_CONFLICTO: "El pedido cambió. Actualiza la ruta.",
        VERSION_CARGA_CONFLICTO: "La carga cambió. Vuelve a revisar el cierre.",
        RESUMEN_CIERRE_CONFLICTO: "Los pedidos cambiaron. Vuelve a revisar el cierre.",
        DESCRIPCION_ENTREGA_FALLIDA_REQUERIDA: "Describe el motivo Otro antes de confirmar.",
        CARGA_NO_SALIO: "La jornada no está en ruta. Actualiza la página.",
        REGIMEN_CONTABLE_NO_COMPATIBLE: "Este pedido requiere gestión administrativa por su régimen contable.",
        ESTADO_PEDIDO_INVALIDO: "El pedido ya no admite esta operación. Consulta el estado actualizado.",
        RUTA_CERRADA: "La ruta ya está cerrada. Actualiza la página.",
      };
      return { error: mensajes[error.message] ?? "No se pudo verificar la operación. Reintenta con la misma solicitud; si persiste, consulta a administración." };
    }
    if (s.accion !== "revisar_cierre") {
      for (const ruta of ["/reparto", "/admin/rutas", "/admin/pedidos", "/admin/clientes", "/mi-cuenta/pedidos"]) {
        try { revalidatePath(ruta, "layout"); } catch { /* El cliente también refresca tras confirmar. */ }
      }
    }
    if (["revisar_cierre", "cerrar"].includes(s.accion)) {
      if (!data || data.fecha !== s.fecha || !Number.isSafeInteger(data.version) || data.version < 0 || !/^[a-f0-9]{64}$/.test(data.huella) || !["en_ruta", "cerrada"].includes(data.estado)) return { error: "Respuesta sin verificar. Reintenta la misma solicitud." };
      return { cierre: { version: data.version, huella: data.huella, estado: data.estado } };
    }
    return data?.ok === true ? { ok: true } : { error: "Respuesta sin verificar. Reintenta la misma solicitud." };
  } catch { return { error: "Conexión interrumpida. Reintenta con la misma solicitud." }; }
}
