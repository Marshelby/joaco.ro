import { respuestaSolicitud, type RespuestaSolicitud } from "./contrato";
export const CLAVE_INTENTOS = "hidro-leufu-posibles-intentos-v1";
export type Intento = { clave: string; secreto: string; expira: number; respuesta?: RespuestaSolicitud };
export async function huellaSolicitud(datos: unknown) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(datos)));
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2,"0")).join("");
}
export function obtenerIntento(almacen: Storage, huella: string, ahora = Date.now()): Intento {
  const guardados = leerIntentos(almacen, ahora);
  if (guardados[huella]) return guardados[huella];
  const intento: Intento = { clave: crypto.randomUUID(), secreto: Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2,"0")).join(""), expira: ahora + 86400000 };
  almacen.setItem(CLAVE_INTENTOS, JSON.stringify({ ...guardados, [huella]: intento }));
  return intento;
}
function leerIntentos(almacen: Storage, ahora = Date.now()): Record<string,Intento> {
  const texto = almacen.getItem(CLAVE_INTENTOS);
  if (!texto) return {};
  // Si el almacenamiento está corrupto, bloquear: no generar otra clave silenciosamente.
  const guardados: unknown = JSON.parse(texto);
  if (!guardados || typeof guardados !== "object" || Array.isArray(guardados)) throw new Error("ALMACEN_INVALIDO");
  for (const i of Object.values(guardados)) {
    if (!i || typeof i !== "object" || typeof i.clave !== "string" || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(i.clave) || typeof i.secreto !== "string" || !/^[a-f0-9]{64}$/.test(i.secreto) || !Number.isFinite(i.expira)) throw new Error("ALMACEN_INVALIDO");
    if (i.respuesta) respuestaSolicitud.parse(i.respuesta);
  }
  // Conservar intentos inciertos incluso vencidos: descartarlos podría duplicar un alta.
  return Object.fromEntries(Object.entries(guardados).filter(([,i]) => !i.respuesta || i.expira > ahora));
}
export function guardarRespuesta(almacen: Storage, huella: string, intento: Intento, respuesta: RespuestaSolicitud) {
  const guardados = leerIntentos(almacen);
  almacen.setItem(CLAVE_INTENTOS, JSON.stringify({ ...guardados, [huella]: { ...intento, respuesta: respuestaSolicitud.parse(respuesta) } }));
}
