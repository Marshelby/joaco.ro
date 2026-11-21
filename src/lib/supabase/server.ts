import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

function configuracion() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Falta configuración pública de Supabase.");
  return { url, key };
}

export async function crearClienteSupabaseServidor({ sinCache = false } = {}) {
  const almacenCookies = await cookies();
  const { url, key } = configuracion();
  return createServerClient(url, key, {
    global: sinCache ? { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) } : undefined,
    cookies: {
      getAll: () => almacenCookies.getAll(),
      setAll: (cookiesParaGuardar) => {
        try { cookiesParaGuardar.forEach(({ name, value, options }) => almacenCookies.set(name, value, options)); } catch { /* Server Components no pueden escribir cookies. */ }
      },
    },
  });
}
