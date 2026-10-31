import "server-only";

export function fasePosiblesPedidosHabilitada() {
  return process.env.POSIBLES_PEDIDOS_ENABLED !== "false";
}
export function configuracionRegistro() {
  if (!fasePosiblesPedidosHabilitada()) return null;
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
