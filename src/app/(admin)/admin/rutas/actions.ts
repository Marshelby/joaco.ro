"use server";

import { revalidatePath } from "next/cache";
import { crearClienteSupabaseServidor } from "@/lib/supabase/server";

export async function ordenRutaDiaAction(fecha: string, orden?: string[], version?: number, rutaId?: string): Promise<{
  orden?: string[]; version?: number; error?: string;
}> {
  try {
    const supabase = await crearClienteSupabaseServidor();
    if (rutaId) {
      const { data: permiso, error: errorPermiso } = await supabase.rpc("es_admin");
      if (errorPermiso || permiso !== true) return { error: "No autorizado." };
      if (orden) {
        const { data, error } = await supabase.rpc("operar_ruta_multiple", { p_solicitud: {
          accion: "ordenar", ruta: rutaId, fecha, pedidos: orden, version, clave: crypto.randomUUID(),
        } });
        if (error || data?.ok !== true) return { error: "El orden no se pudo confirmar. Actualiza la ruta antes de continuar." };
        revalidatePath("/admin/rutas");
        return { orden, version: data.version };
      }
      const { data, error } = await supabase.rpc("leer_rutas_multiples", { p_fecha: fecha });
      const ruta = data?.rutas?.find((r: { id: string }) => r.id === rutaId);
      if (error || !ruta || !Array.isArray(ruta.pedidos) || !Number.isSafeInteger(ruta.version)) return { error: "No se pudo leer esta ruta." };
      return { orden: ruta.pedidos, version: ruta.version };
    }
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
