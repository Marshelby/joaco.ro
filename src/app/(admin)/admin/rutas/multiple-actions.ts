"use server";

import { revalidatePath } from "next/cache";
import { exigirAdminReparto } from "@/lib/reparto/server";
import type { SolicitudRutaMultiple } from "./multiple-types";

export async function operarRutaMultiple(s: SolicitudRutaMultiple): Promise<{ ok?: boolean; error?: string }> {
  const db = await exigirAdminReparto();
  if (!s || typeof s !== "object" || JSON.stringify(s).length > 100000 || !Number.isSafeInteger(s.version) || s.version < 0) return { error: "Solicitud inválida." };
  try {
    const { data, error } = await db.rpc("operar_ruta_multiple", { p_solicitud: s });
    if (error) {
      const mensajes: Record<string, string> = {
        REGIMEN_CONTABLE_NO_COMPATIBLE: "Un pedido usa un régimen contable incompatible. No se despachó la ruta; requiere gestión administrativa.",
        INCORPORACION_REQUIERE_LISTO: "Solo se incorporan pedidos completamente preparados. Los parciales deben salir en otra ruta con autorización propia.",
        SELECCION_INVALIDA: "Selecciona pedidos disponibles, finalizados y de esta fecha. No se retiran pedidos ya despachados.",
        MOTIVO_REQUERIDO: "Registra un motivo para esta operación administrativa.",
        VERSION_RUTA_CONFLICTO: "La ruta cambió. Actualiza antes de continuar.",
        VERSION_OPERATIVA_CONFLICTO: "La preparación cambió. Actualiza y revisa las cantidades.",
        PEDIDO_YA_ASIGNADO: "Un pedido ya pertenece a otra ruta. Actualiza la selección.",
        RUTA_NO_EDITABLE: "La ruta ya salió o está cerrada.",
        PARCIAL_NO_AUTORIZADO: "Autoriza expresamente cada pedido parcial con sus cantidades actuales.",
        PRODUCTOS_PENDIENTES: "Confirma las cantidades e importes de los productos y finaliza cada preparación.",
        PEDIDO_NO_LISTO: "Finaliza la preparación de los pedidos antes de salir.",
        PEDIDOS_PENDIENTES: "Resuelve todos los pedidos de esta ruta antes de cerrarla.",
        REPARTIDORES_REQUERIDOS: "Asigna al menos un repartidor habilitado.",
        JORNADA_LEGACY: "Esta fecha conserva una carga anterior. Gestiona su cierre con el flujo existente.",
        SIN_PREPARAR: "Un pedido sin cantidades preparadas no puede salir.",
        PREPARACION_FECHA_NO_HABILITADA: "Solo se permite preparar o salir el día de entrega en America/Santiago.",
        REPARTIDOR_NO_HABILITADO: "La asignación incluye un repartidor que ya no está habilitado.",
        CLAVE_IDEMPOTENCIA_EN_USO: "La solicitud no coincide con su clave original. Consulta el estado actualizado.",
      };
      return { error: mensajes[error.message] ?? "No se pudo confirmar la operación. Consulta el estado o reintenta la misma solicitud." };
    }
    if (data?.ok !== true) return { error: "Respuesta sin verificar. Reintenta la misma solicitud." };
    for (const path of ["/admin/rutas", "/admin/pedidos", "/reparto"]) revalidatePath(path);
    return { ok: true };
  } catch { return { error: "Respuesta no recibida. Reintenta la misma solicitud." }; }
}
