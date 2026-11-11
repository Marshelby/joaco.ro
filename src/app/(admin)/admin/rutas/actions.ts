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
    if (error?.code === "PGRST202" || error?.code === "42883") {
      return { error: "No está disponible la RPC orden_ruta_dia. Comprueba que se haya aplicado la migración 20261107120000_orden_ruta_dia_sin_cambiar_estados.sql en Supabase y que su caché de esquema esté actualizada." };
    }
    if (error?.message === "REPROGRAMADO_REQUIERE_INCLUSION_EXPLICITA") return { error: "Hay un pedido reprogramado pendiente de inclusión. Inclúyelo explícitamente en la carga antes de guardar el orden de ruta." };
    if (error?.message === "RUTA_CERRADA") return { error: "La ruta está cerrada. Su orden no se puede modificar." };
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
