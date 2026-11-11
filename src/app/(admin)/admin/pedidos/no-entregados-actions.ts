"use server";

import { revalidatePath } from "next/cache";
import { crearClienteSupabaseServidor } from "@/lib/supabase/server";

export type ResolucionNoEntregado = {
  pedido: string; version: number; clave: string; accion: "reprogramar" | "cancelar";
  motivo: string; fecha: string; tratamiento: string;
};
const uuid = (v: unknown) => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
async function clienteAdmin() {
  const db = await crearClienteSupabaseServidor();
  const { data, error } = await db.auth.getUser();
  const admin = await db.rpc("es_admin");
  if (error || !data.user || admin.error || admin.data !== true) throw new Error("NO_AUTORIZADO");
  return db;
}
export async function prepararResolucionNoEntregado(id: string): Promise<{ version?: number; error?: string }> {
  if (!uuid(id)) return { error: "Pedido inválido." };
  try {
    const db = await clienteAdmin();
    const { data, error } = await db.rpc("leer_resolucion_no_entregado_admin", { p_pedido_id: id });
    if (error) return { error: error.code === "PGRST202" ? "Las acciones requieren instalar el SQL manual de Fase 4." : "No se pudo cargar la versión. Actualiza e intenta nuevamente." };
    const version = Number(data?.version);
    if (data?.version == null || !Number.isSafeInteger(version) || version < 0 || version >= Number.MAX_SAFE_INTEGER) return { error: "La versión del pedido no es válida." };
    return { version };
  } catch { return { error: "No se pudo verificar la sesión administrativa." }; }
}
export async function resolverNoEntregado(s: ResolucionNoEntregado, confirmado: boolean): Promise<{ exito?: boolean; error?: string }> {
  if (!s || confirmado !== true || !uuid(s.pedido) || !uuid(s.clave) || !Number.isSafeInteger(s.version) || s.version < 0 || s.version >= Number.MAX_SAFE_INTEGER ||
    !["reprogramar", "cancelar"].includes(s.accion) || typeof s.motivo !== "string" || !s.motivo.trim() || s.motivo.length > 2000 ||
    (s.accion === "cancelar" && (typeof s.tratamiento !== "string" || !s.tratamiento.trim() || s.tratamiento.length > 2000)) ||
    (s.accion === "reprogramar" && (typeof s.fecha !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s.fecha) || !Number.isFinite(Date.parse(s.fecha)) || new Date(s.fecha).toISOString().slice(0, 10) !== s.fecha))) {
    return { error: "Revisa fecha, motivo y tratamiento administrativo y confirma la operación." };
  }
  try {
    const db = await clienteAdmin();
    const comunes = { p_pedido_id: s.pedido, p_version_esperada: s.version, p_clave: s.clave, p_motivo: s.motivo };
    const { data, error } = s.accion === "reprogramar"
      ? await db.rpc("reprogramar_no_entregado_administrativo", { ...comunes, p_fecha: s.fecha })
      : await db.rpc("cancelar_no_entregado_administrativo", { ...comunes, p_tratamiento: s.tratamiento });
    if (error) {
      const mensajes: Record<string, string> = {
        NO_AUTORIZADO: "Solo un administrador puede resolver pedidos no entregados.",
        VERSION_OPERATIVA_CONFLICTO: "El pedido cambió. Revisa su detalle y abre una nueva solicitud.",
        CLAVE_IDEMPOTENCIA_EN_USO: "La clave pertenece a otra solicitud. Revisa el historial antes de continuar.",
        PEDIDO_NO_REPROGRAMABLE: "Requiere un intento fallido auditado, preparación finalizada y carga cerrada, sin venta definitiva.",
        PEDIDO_NO_CANCELABLE: "Solo se puede cancelar un intento fallido incluido en una carga cerrada y sin venta definitiva.",
        CIERRE_REQUERIDO: "Primero debes cerrar la ruta del intento fallido.",
        RUTA_CERRADA: "La barrera de cierre impidió la operación. Revisa el pedido y su evidencia.",
        ENTREGA_FALLIDA_SIN_REPROGRAMACION: "La evidencia del fallo no permite esta operación administrativa.",
        SALDO_HISTORICO_REQUIERE_TRATAMIENTO: "Este pedido pertenece al régimen legado. Su cancelación requiere resolver explícitamente los cargos históricos fuera de esta fase; no se modificó ningún saldo.",
        TRAZABILIDAD_INTENTO_INVALIDA: "El pedido no coincide con el intento cerrado. Revisa el historial; no se modificó el cierre.",
        FECHA_REPROGRAMACION_INVALIDA: "Selecciona una fecha posterior al intento original y que no esté en el pasado en Chile.",
        CARGA_NO_EDITABLE: "La nueva jornada debe estar en preparación, sin salida ni cierre.",
        TRATAMIENTO_ADMINISTRATIVO_REQUERIDO: "Registra el tratamiento explícito de pagos y créditos (máximo 2000 caracteres).",
        PEDIDO_NO_ENCONTRADO: "El pedido ya no está disponible.",
      };
      return { error: error.code === "PGRST202" ? "Falta instalar el SQL manual de Fase 4 o su dependencia de Fase 2." : mensajes[error.message] ?? "No se pudo confirmar el resultado. Reintenta la misma solicitud sin cambiar sus datos." };
    }
    const r = data?.resultado;
    if (r?.pedido_id !== s.pedido || r.estado !== (s.accion === "cancelar" ? "cancelado" : "listo_despacho") ||
      (s.accion === "reprogramar" && (r.incluido !== false || r.fecha !== s.fecha)) ||
      (s.accion === "cancelar" && r.pagos_creditos_preservados !== true)) {
      return { error: "Respuesta no verificable. Reintenta la misma solicitud sin cambiar sus datos." };
    }
  } catch { return { error: "No se pudo confirmar la operación. Verifica la sesión y reintenta la misma solicitud." }; }
  for (const ruta of ["/admin/pedidos", "/admin/rutas", "/reparto", "/mi-cuenta/pedidos"]) {
    try { revalidatePath(ruta, "layout"); } catch { /* La operación ya fue confirmada; el cliente refresca. */ }
  }
  return { exito: true };
}
