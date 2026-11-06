import { z } from "zod";
import { administradorComercial } from "@/lib/admin/cliente-comercial";
import { LocationSearchError, searchCommercialLocations } from "@/lib/admin/location-search-provider";
import { consumeLocationSearchQuota } from "@/lib/admin/location-search-rate-limit";

export const runtime = "nodejs";

const inputSchema = z.object({ query: z.string().trim().min(3).max(200) }).strict();
function reply(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", ...extra } });
}

export async function POST(request: Request) {
  const allowedOrigin = process.env.LOCATION_SEARCH_ALLOWED_ORIGIN;
  if (!allowedOrigin) return reply({ error: "El origen del buscador no está configurado. Puedes usar el mapa manual.", code: "ORIGIN_CONFIG" }, 503);
  if (request.headers.get("origin") !== allowedOrigin || request.headers.get("sec-fetch-site") === "cross-site") {
    return reply({ error: "Origen de solicitud no permitido.", code: "INVALID_ORIGIN" }, 403);
  }
  try {
    await administradorComercial();
  } catch {
    return reply({ error: "Debes iniciar sesión con una cuenta administrativa para buscar.", code: "UNAUTHORIZED" }, 403);
  }
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    return reply({ error: "La solicitud debe contener JSON.", code: "INVALID_CONTENT_TYPE" }, 415);
  }
  // Limitar también el cuerpo real, incluso sin Content-Length.
  let input: unknown;
  try {
    const reader = request.body?.getReader();
    if (!reader) return reply({ error: "Falta el cuerpo JSON.", code: "INVALID_JSON" }, 400);
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 4096) {
          await reader.cancel();
          return reply({ error: "La solicitud es demasiado grande.", code: "BODY_TOO_LARGE" }, 413);
        }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    input = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    return reply({ error: "El JSON no es válido.", code: "INVALID_JSON" }, 400);
  }
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return reply({ error: "Escribe una consulta de 3 a 200 caracteres.", code: "INVALID_QUERY" }, 400);
  if (!process.env.GEOAPIFY_API_KEY?.trim()) return reply({ error: "El buscador no está configurado. Puedes usar el mapa manual.", code: "PROVIDER_CONFIG" }, 503);
  try {
    const quota = await consumeLocationSearchQuota(request.signal);
    if (!quota.allowed) return reply({ error: "Se alcanzó el límite compartido de búsquedas. Intenta más tarde o usa el mapa manual.", code: "RATE_LIMITED" }, 429, { "Retry-After": String(quota.retryAfter) });
  } catch {
    return reply({ error: "Búsqueda deshabilitada: el limitador compartido no está configurado o no está disponible. Puedes usar el mapa manual.", code: "LIMITER_UNAVAILABLE" }, 503);
  }
  try {
    const results = await searchCommercialLocations(parsed.data.query, request.signal);
    return reply({ results });
  } catch (error) {
    if (error instanceof LocationSearchError) return reply({ error: error.message, code: error.code }, error.status);
    return reply({ error: "No fue posible buscar. Puedes usar el mapa manual.", code: "SEARCH_UNAVAILABLE" }, 503);
  }
}
