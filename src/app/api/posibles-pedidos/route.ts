import { registrarSolicitudHTTP, respuestaHTTP } from "@/lib/posibles-pedidos/http";
import { crearRegistroServidor } from "@/lib/posibles-pedidos/servidor";
import { problemasConfiguracionRegistro } from "@/lib/posibles-pedidos/configuracion";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const deps = crearRegistroServidor();
  if (!deps) {
    console.error("[posibles-pedidos] Configuración de registro incompleta", { problemas: problemasConfiguracionRegistro() });
    return respuestaHTTP({ error: "El registro por WhatsApp no está disponible por configuración del servicio. Intenta más tarde o contacta a Hidro Leufú." }, 503);
  }
  return registrarSolicitudHTTP(request, deps);
}
