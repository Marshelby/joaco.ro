import "server-only";

import { createClient } from "@supabase/supabase-js";

const transientStatuses = new Set([408, 429, 502, 503, 504, 520, 522, 524]);

// Solo para las lecturas públicas del catálogo. Nunca reutilizar para escrituras
// o datos de cuenta: no lee ni renueva la sesión del visitante.
const storefrontFetch: typeof fetch = async (input, init) => {
  if (init?.method !== "GET") throw new Error("El cliente público solo permite lecturas GET.");

  for (let attempt = 0; attempt < 2; attempt++) {
    const timeout = AbortSignal.timeout(8000);
    const signal = init.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
    try {
      const response = await fetch(input, { ...init, cache: "no-store", signal });
      // Consumir también el cuerpo dentro del plazo, antes de iniciar otro intento.
      const body = await response.arrayBuffer();
      if (attempt === 0 && transientStatuses.has(response.status)) {
        console.warn("[storefront] Reintentando lectura pública", { status: response.status });
      } else {
        const emptyBody = [204, 205, 304].includes(response.status);
        return new Response(emptyBody ? null : body, { status: response.status, statusText: response.statusText, headers: response.headers });
      }
    } catch (error) {
      if (init.signal?.aborted || attempt === 1) throw error;
      if (!timeout.aborted && !(error instanceof TypeError)) throw error;
      console.warn("[storefront] Reintentando lectura pública por fallo de transporte");
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  throw new Error("Se agotaron los intentos de lectura pública.");
};

export function crearClienteSupabaseCatalogo() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Falta configuración pública de Supabase.");

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    db: { retry: false }, // Una sola capa de reintento, sin multiplicar consultas.
    global: { fetch: storefrontFetch },
  });
}
