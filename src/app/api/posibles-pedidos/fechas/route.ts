import { crearClienteSupabaseServidor } from "@/lib/supabase/server";
import { fasePosiblesPedidosHabilitada } from "@/lib/posibles-pedidos/configuracion";
import { respuestaHTTP } from "@/lib/posibles-pedidos/http";
export async function GET() {
  // Leer fechas públicas no requiere los secretos de la operación de registro.
  if (!fasePosiblesPedidosHabilitada()) return respuestaHTTP({ error: "Solicitudes por WhatsApp no disponibles." }, 503);
  try {
    const supabase = await crearClienteSupabaseServidor();
    const { data, error } = await supabase.rpc("obtener_fechas_posibles_pedidos");
    if (error) {
      console.error("[posibles-pedidos/fechas] Falló la RPC de fechas", { codigo: error.code });
      return respuestaHTTP({ error: "No pudimos cargar las fechas. Intenta nuevamente." }, 503);
    }
    return respuestaHTTP({ fechas: (data ?? []).slice(0, 3).map((fila: { fecha: string }) => fila.fecha) });
  } catch { return respuestaHTTP({ error: "No pudimos cargar las fechas. Intenta nuevamente." }, 503); }
}
