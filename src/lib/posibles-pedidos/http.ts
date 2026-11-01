import { mensajeErrorPosiblePedido, payloadSolicitud, respuestaSolicitud, type PayloadSolicitud } from "./contrato";

export type DependenciasRegistro = {
  registrar: (datos: PayloadSolicitud) => Promise<{ data: unknown; error: { message: string } | null }>;
};
export function respuestaHTTP(valor: unknown, status = 200, extras?: Record<string,string>) {
  return Response.json(valor, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...extras } });
}
async function leerCuerpoAcotado(request: Request) {
  const maximo = 48 * 1024;
  if (Number(request.headers.get("content-length")) > maximo) throw new Error("CUERPO_GRANDE");
  if (!request.body) throw new Error("JSON_INVALIDO");
  const lector = request.body.getReader(); let bytes = 0; const partes: Uint8Array[] = [];
  try {
    for (;;) {
      const { done, value } = await lector.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maximo) { await lector.cancel(); throw new Error("CUERPO_GRANDE"); }
      partes.push(value);
    }
  } finally { lector.releaseLock(); }
  const cuerpo = new Uint8Array(bytes); let posicion = 0;
  for (const parte of partes) { cuerpo.set(parte, posicion); posicion += parte.length; }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(cuerpo));
}
export async function registrarSolicitudHTTP(request: Request, deps: DependenciasRegistro) {
  if (request.headers.get("origin") !== new URL(request.url).origin || request.headers.get("sec-fetch-site") === "cross-site") return respuestaHTTP({ error: "Origen no permitido." }, 403);
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") return respuestaHTTP({ error: "Envía los datos como JSON." }, 415);
  let cuerpo: unknown;
  try { cuerpo = await leerCuerpoAcotado(request); } catch (error) {
    return respuestaHTTP({ error: "No pudimos leer los datos de la solicitud." }, error instanceof Error && error.message === "CUERPO_GRANDE" ? 413 : 400);
  }
  const validado = payloadSolicitud.safeParse(cuerpo);
  if (!validado.success) return respuestaHTTP({ error: "Revisa el nombre, teléfono, fecha y productos de tu solicitud." }, 400);
  try {
    const { data, error } = await deps.registrar(validado.data);
    if (error) {
      if (error.message === "LIMITE_SOLICITUDES") return respuestaHTTP({ error: "Recibimos varias solicitudes. Espera unos minutos antes de volver a intentar." }, 429, { "Retry-After": "600" });
      const conflicto = ["REINTENTO_INVALIDO","FECHA_FUERA_DE_OPCIONES","POSIBLE_PEDIDO_CERRADO","LIMITE_VERSIONES"].includes(error.message);
      const conocido = /^(PRODUCTO_NO_DISPONIBLE|PRESENTACION_NO_DISPONIBLE|CATEGORIA_NO_DISPONIBLE|CANTIDAD_INVALIDA|PRESENTACION_DUPLICADA|PRECIO_INVALIDO|LIMITE_.*|SOLICITUD_INVALIDA|TELEFONO_INVALIDO)$/.test(error.message);
      return respuestaHTTP({ error: mensajeErrorPosiblePedido(error.message), ...(error.message === "FECHA_FUERA_DE_OPCIONES" ? { codigo: error.message } : {}) }, conflicto ? 409 : conocido ? 400 : 503);
    }
    const respuesta = respuestaSolicitud.safeParse(data);
    if (!respuesta.success) return respuestaHTTP({ error: "No pudimos verificar el resultado. Reintenta conservando esta solicitud." }, 503);
    return respuestaHTTP({ solicitud: respuesta.data });
  } catch {
    return respuestaHTTP({ error: "El servicio no está disponible. Conserva esta solicitud para volver a intentar." }, 503);
  }
}
