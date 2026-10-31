import "server-only";

export function fasePosiblesPedidosHabilitada() {
  return process.env.POSIBLES_PEDIDOS_ENABLED !== "false";
}
// Solo nombres y motivos: nunca incluir valores de configuración en el diagnóstico.
export function problemasConfiguracionRegistro(): string[] {
  const problemas: string[] = [];
  if (!fasePosiblesPedidosHabilitada()) problemas.push("POSIBLES_PEDIDOS_ENABLED: deshabilitado");
  for (const nombre of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "APP_ORIGIN", "TURNSTILE_SECRET_KEY", "NEXT_PUBLIC_TURNSTILE_SITE_KEY", "POSIBLES_PEDIDOS_HMAC_SECRET"]) {
    if (!process.env[nombre]?.trim()) problemas.push(`${nombre}: ausente`);
  }
  if (process.env.POSIBLES_PEDIDOS_HMAC_SECRET && process.env.POSIBLES_PEDIDOS_HMAC_SECRET.length < 32) problemas.push("POSIBLES_PEDIDOS_HMAC_SECRET: requiere al menos 32 caracteres");
  for (const nombre of ["APP_ORIGIN", "NEXT_PUBLIC_SUPABASE_URL"]) {
    const valor = process.env[nombre];
    if (!valor?.trim()) continue;
    try {
      const url = new URL(valor);
      if (!["http:", "https:"].includes(url.protocol)) throw new Error();
      if (nombre === "APP_ORIGIN" && (url.origin !== valor || (url.protocol !== "https:" && !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)))) throw new Error();
    } catch { problemas.push(`${nombre}: URL inválida`); }
  }
  return problemas;
}
export function configuracionRegistro() {
  if (problemasConfiguracionRegistro().length) return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const origen = process.env.APP_ORIGIN;
  const captchaSecret = process.env.TURNSTILE_SECRET_KEY;
  const captchaSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const hmacSecret = process.env.POSIBLES_PEDIDOS_HMAC_SECRET;
  if (!url || !key || !origen || !captchaSecret || !captchaSiteKey || !hmacSecret || hmacSecret.length < 32) return null;
  try {
    const app = new URL(origen);
    const supabase = new URL(url);
    if (app.origin !== origen || !["http:","https:"].includes(app.protocol) || !["http:","https:"].includes(supabase.protocol)) return null;
    if (app.protocol !== "https:" && !["localhost","127.0.0.1","[::1]"].includes(app.hostname)) return null;
    return { url, key, origen, captchaSecret, captchaSiteKey, hmacSecret };
  } catch { return null; }
}
