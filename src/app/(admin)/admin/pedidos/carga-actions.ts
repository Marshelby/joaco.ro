"use server";

import { revalidatePath } from "next/cache";
import { crearClienteSupabaseServidor } from "@/lib/supabase/server";
import type { CargaJornada } from "@/lib/admin/cargas";

const errores: Record<string, string> = {
  PARCIAL_NO_AUTORIZADO: "El parcial requiere cerrar nuevamente su preparación con autorización y cantidades actuales. Reabre la carga si ya estaba confirmada.",
  SIN_PREPARAR: "Un pedido sin productos preparados debe resolverse por falta de stock o excluirse antes de salir.",
  NO_AUTORIZADO: "Se requiere una sesión administrativa.",
  VERSION_CARGA_CONFLICTO: "La carga cambió. Recarga y revisa la selección antes de continuar.",
  CLAVE_IDEMPOTENCIA_EN_USO: "Esta clave ya corresponde a otra solicitud. Recarga para revisar.",
  PRODUCTOS_PENDIENTES: "Hay productos pendientes de confirmación explícita.",
  PEDIDO_NO_LISTO: "Todos los pedidos incluidos deben estar en listo para despacho y conservar la fecha de la carga.",
  PREPARACION_FECHA_NO_HABILITADA: "Solo puedes guardar, confirmar, salir o volver a preparación en la fecha efectiva de hoy en America/Santiago.",
  CARGA_YA_SALIO: "La carga ya salió a ruta y no admite retrocesos globales.",
  CARGA_VACIA: "Incluye al menos un pedido antes de confirmar.",
  MOTIVO_REQUERIDO: "Indica un motivo para volver a preparación.",
  DECISIONES_PENDIENTES: "Hay pedidos nuevos sin decisión guardada. Actualiza y guarda su inclusión o exclusión antes de confirmar.",
  EXCLUSION_REQUIERE_MOTIVO: "Conserva cada pedido asociado e indica un motivo para excluirlo.",
  SELECCION_INVALIDA: "La selección contiene pedidos que cambiaron o no pertenecen a esta jornada.",
  PEDIDO_EN_OTRA_CARGA: "Un pedido ya pertenece a otra carga persistida.",
};

export async function operarCargaAction(input: {
  fecha: string; version: number; clave: string; accion: "guardar" | "confirmar" | "salir" | "reabrir";
  pedidos: { id: string; incluido: boolean; motivo: string }[] | null; motivo: string | null;
}): Promise<{ error?: string; carga?: CargaJornada }> {
  const supabase = await crearClienteSupabaseServidor();
  const { data, error } = await supabase.rpc("operar_carga_jornada", {
    p_fecha: input.fecha, p_version: input.version, p_clave: input.clave,
    p_accion: input.accion, p_pedidos: input.pedidos, p_motivo: input.motivo,
  });
  if (error) return { error: errores[error.message] ?? "No se pudo completar la operación. Revisa la carga y los motivos de exclusión antes de reintentar." };
  revalidatePath("/admin", "layout");
  revalidatePath("/mi-cuenta/pedidos", "layout");
  return { carga: { ...data, historial: [] } as CargaJornada };
}
