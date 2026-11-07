"use server";

import { crearClienteSupabaseServidor } from "@/lib/supabase/server";

export async function ordenRutaDiaAction(fecha: string, orden?: string[], version?: number): Promise<{
  orden?: string[]; version?: number; error?: string;
}> {
  try {
    const supabase = await crearClienteSupabaseServidor();
    const { data, error } = await supabase.rpc("orden_ruta_dia", {
      p_fecha: fecha, p_orden: orden ?? null, p_version: version ?? null,
    });
    if (error) return { error: ["RUTA_DESACTUALIZADA", "PEDIDOS_DESACTUALIZADOS"].includes(error.message)
      ? "La ruta cambió en otra sesión o cambiaron los pedidos. Recarga antes de reordenar."
      : "No se pudo leer o guardar el orden. Reintenta y comprueba que la migración de Ruta del día esté aplicada." };
    if (!data || !Array.isArray(data.orden) || !Number.isSafeInteger(data.version)) {
      return { error: "No se recibió una confirmación válida del orden. Recarga antes de continuar." };
    }
    return { orden: data.orden, version: data.version };
  } catch {
    return { error: "No se pudo confirmar el orden por un error de conexión. Recarga antes de continuar." };
  }
}
