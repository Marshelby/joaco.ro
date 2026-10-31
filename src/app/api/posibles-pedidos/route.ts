import { registrarSolicitudHTTP, respuestaHTTP } from "@/lib/posibles-pedidos/http";
import { crearRegistroServidor } from "@/lib/posibles-pedidos/servidor";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const deps = crearRegistroServidor();
  if (!deps) return respuestaHTTP({ error: "Las solicitudes por WhatsApp aún no están disponibles. Puedes realizar tu pedido por la web." }, 503);
  return registrarSolicitudHTTP(request, deps);
}
