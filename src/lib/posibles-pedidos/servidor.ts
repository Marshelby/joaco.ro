import "server-only";
import { createClient } from "@supabase/supabase-js";
import { createHmac } from "node:crypto";
import { isIP } from "node:net";
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
  const huella = (tipo: string, valor: string) => createHmac("sha256", config.hmacSecret).update(`${tipo}:${valor}`).digest("hex");
  return {
    origen: config.origen,
    limitar: async (request, telefono) => {
      // Solo confiar en un header si el proxy de despliegue garantiza sobrescribirlo.
      const header = process.env.POSIBLES_PEDIDOS_TRUSTED_IP_HEADER;
      const recibido = header && ["cf-connecting-ip","x-vercel-forwarded-for"].includes(header) ? request.headers.get(header)?.trim() : null;
      const origen = recibido && isIP(recibido) ? recibido : "cuota-compartida-sin-ip-confiable";
      const { data, error } = await supabase.rpc("consumir_limite_posibles_pedidos", { p_origen_hash: huella("origen", origen), p_telefono_hash: huella("telefono", telefono) });
      if (error || typeof data !== "boolean") throw new Error("LIMITE_NO_DISPONIBLE");
      return data;
    },
    verificarCaptcha: async (token) => {
      const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST", body: new URLSearchParams({ secret: config.captchaSecret, response: token }), signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) return false;
      const resultado: unknown = await response.json();
      if (!resultado || typeof resultado !== "object") return false;
      const captcha = resultado as { success?: unknown; hostname?: unknown };
      return captcha.success === true && captcha.hostname === new URL(config.origen).hostname;
    },
    registrar: async (datos) => {
      const { data, error } = await supabase.rpc("registrar_posible_pedido_whatsapp", {
        p_nombre: datos.nombre, p_telefono: datos.telefono, p_fecha: datos.fecha,
        p_observaciones: datos.observaciones || null, p_items: datos.items,
        p_clave_idempotencia: datos.claveIdempotencia, p_secreto_reintento: datos.secretoReintento,
      });
      return { data, error };
    },
  };
}
