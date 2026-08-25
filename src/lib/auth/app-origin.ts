import "server-only";

import { headers } from "next/headers";

export async function obtenerOrigenAplicacion() {
  const encabezados = await headers();
  const origin = encabezados.get("origin");
  if (origin) {
    const url = new URL(origin);
    if (url.protocol === "https:" || url.protocol === "http:") return url.origin;
  }

  const host = encabezados.get("x-forwarded-host") ?? encabezados.get("host");
  if (!host || host.includes("/")) throw new Error("No fue posible determinar el origen de la aplicación.");
  const protocol = encabezados.get("x-forwarded-proto") === "https" ? "https" : "http";
  return `${protocol}://${host}`;
}
