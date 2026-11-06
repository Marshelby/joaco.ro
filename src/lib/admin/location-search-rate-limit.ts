import "server-only";

// Redis ejecuta ambas cuotas en una sola operación; ninguna instancia guarda contadores locales.
// Las claves son compartidas por todos los despliegues que usan esta base de datos.
const script = `
local minute = tonumber(redis.call('GET', KEYS[1]) or '0')
local daily = tonumber(redis.call('GET', KEYS[2]) or '0')
if minute >= 30 then return {0, redis.call('TTL', KEYS[1])} end
if daily >= 500 then return {0, redis.call('TTL', KEYS[2])} end
if redis.call('INCR', KEYS[1]) == 1 then redis.call('EXPIRE', KEYS[1], 60) end
if redis.call('INCR', KEYS[2]) == 1 then redis.call('EXPIRE', KEYS[2], 86400) end
return {1, 0}
`;

export async function consumeLocationSearchQuota(signal: AbortSignal): Promise<
  { allowed: true } | { allowed: false; retryAfter: number }
> {
  const endpoint = process.env.LOCATION_SEARCH_REDIS_REST_URL;
  const token = process.env.LOCATION_SEARCH_REDIS_REST_TOKEN;
  if (!endpoint || !token) throw new Error("LIMITER_UNAVAILABLE");
  const url = new URL(endpoint);
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
    throw new Error("LIMITER_UNAVAILABLE");
  }
  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(["EVAL", script, "2", "hidro-leufu:location-search:minute", "hidro-leufu:location-search:daily"]),
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.any([signal, AbortSignal.timeout(2500)]),
  });
  if (!response.ok) throw new Error("LIMITER_UNAVAILABLE");
  const body: unknown = await response.json();
  if (!body || typeof body !== "object" || !("result" in body) || ("error" in body && body.error)) throw new Error("LIMITER_UNAVAILABLE");
  const result = body.result;
  if (!Array.isArray(result) || result.length !== 2 || ![0, 1].includes(result[0]) || !Number.isInteger(result[1]) || result[1] < 0) {
    throw new Error("LIMITER_UNAVAILABLE");
  }
  return result[0] === 1 ? { allowed: true } : { allowed: false, retryAfter: Math.max(1, result[1]) };
}
