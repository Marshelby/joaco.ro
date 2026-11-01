import "server-only";
import { createClient } from "@supabase/supabase-js";
import { configuracionRegistro } from "./configuracion";
import type { DependenciasRegistro } from "./http";

export function crearRegistroServidor(): DependenciasRegistro | null {
  const config = configuracionRegistro();
  if (!config) return null;
  // Cliente independiente: nunca recibe cookies ni Authorization del visitante.
  const supabase = createClient(config.url, config.key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(10000) }) },
  });
  return {
    registrar: async (datos) => {
      const { data, error } = await supabase.rpc("registrar_posible_pedido_whatsapp", {
        p_nombre: datos.nombre, p_telefono: datos.telefono, p_fecha: datos.fecha,
        p_observaciones: datos.observaciones || null, p_items: datos.items,
        p_solicitud_clave: datos.solicitudClave ?? null, p_solicitud_secreto: datos.solicitudSecreto ?? null,
        p_clave_idempotencia: datos.claveIdempotencia, p_secreto_reintento: datos.secretoReintento,
      });
      return { data, error };
    },
  };
}
