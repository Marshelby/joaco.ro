import "server-only";

import { z } from "zod";
import type { LocationSearchResult } from "@/lib/admin/location-search-contract";

const responseSchema = z.object({ features: z.array(z.object({ properties: z.object({
  place_id: z.string().min(1),
  formatted: z.string().trim().min(1),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  country_code: z.string(),
  result_type: z.string().optional(),
}) })) });

export class LocationSearchError extends Error {
  constructor(public readonly code: string, message: string, public readonly status: number) {
    super(message);
  }
}

export async function searchCommercialLocations(query: string, signal: AbortSignal): Promise<LocationSearchResult[]> {
  const key = process.env.GEOAPIFY_API_KEY;
  if (!key?.trim()) throw new LocationSearchError("PROVIDER_CONFIG", "El buscador no está configurado. Puedes marcar el punto en el mapa.", 503);
  const url = new URL("https://api.geoapify.com/v1/geocode/autocomplete");
  url.search = new URLSearchParams({ text: query, filter: "countrycode:cl", lang: "es", limit: "5", apiKey: key }).toString();
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal.addEventListener("abort", cancel, { once: true });
  if (signal.aborted) controller.abort();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const response = await fetch(url, { cache: "no-store", redirect: "error", signal: controller.signal });
    if (!response.ok) throw new LocationSearchError(
      response.status === 429 ? "PROVIDER_QUOTA" : "PROVIDER_UNAVAILABLE",
      response.status === 429 ? "Geoapify alcanzó su límite de consultas. Usa el mapa o intenta más tarde." : "Geoapify no está disponible. Puedes marcar el punto en el mapa.",
      503,
    );
    const parsed = responseSchema.safeParse(await response.json());
    if (!parsed.success) throw new LocationSearchError("PROVIDER_RESPONSE", "Geoapify devolvió una respuesta inválida. Usa el mapa o intenta nuevamente.", 502);
    return parsed.data.features.filter(({ properties: p }) => p.country_code.toLowerCase() === "cl").slice(0, 5).map(({ properties: p }) => ({
      id: p.place_id, label: p.formatted, latitude: p.lat, longitude: p.lon, type: p.result_type ?? "unknown",
    }));
  } catch (error) {
    if (error instanceof LocationSearchError) throw error;
    if (controller.signal.aborted) throw new LocationSearchError("PROVIDER_TIMEOUT", "La búsqueda fue cancelada o tardó demasiado. Usa el mapa o intenta nuevamente.", 504);
    throw new LocationSearchError("PROVIDER_CONNECTION", "No fue posible conectar con Geoapify. Puedes usar el mapa manual.", 502);
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", cancel);
  }
}
