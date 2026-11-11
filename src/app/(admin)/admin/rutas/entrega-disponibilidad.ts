import "server-only";
import { crearClienteSupabaseServidor } from "@/lib/supabase/server";
import { mensajeErrorEntrega } from "./entrega-errores";

// Solo lectura. Si falta el diagnóstico SQL, bloquear en lugar de probar una mutación.
export async function leerDisponibilidadEntrega(ids: string[]): Promise<Record<string, string | null>> {
  if (!ids.length) return {};
  const bloqueo = "No se pudo verificar la compatibilidad de entrega y cobro. Requiere revisión de la instalación.";
  const motivos: Record<string, string | null> = Object.fromEntries(ids.map(id => [id, bloqueo]));
  try {
    const db = await crearClienteSupabaseServidor();
    const { data: compatible, error: errorContrato } = await db.rpc("verificar_contrato_confirmar_entrega");
    if (errorContrato || compatible !== true) {
      const mensaje = errorContrato ? mensajeErrorEntrega(errorContrato, bloqueo) : bloqueo;
      return Object.fromEntries(ids.map(id => [id, mensaje]));
    }
    const { data, error } = await db.from("pedidos")
      .select("id,estado,regimen_contable,preparacion_finalizada_en,venta_definitiva_snapshot")
      .in("id", ids);
    if (error) return Object.fromEntries(ids.map(id => [id, mensajeErrorEntrega(error, bloqueo)]));
    for (const p of data ?? []) {
      motivos[p.id] = p.regimen_contable !== "entrega_v1" ? "Pedido legado o incompatible: no admite Confirmar entrega con cobro."
        : p.estado !== "en_reparto" ? "Confirmar entrega requiere que el pedido esté en reparto."
        : p.venta_definitiva_snapshot !== null ? "Este pedido ya tiene una venta definitiva. Recarga para revisar su estado."
        : !p.preparacion_finalizada_en ? "Finaliza la preparación antes de confirmar la entrega." : null;
    }
  } catch { /* Se conserva el bloqueo seguro, sin detalles internos. */ }
  return motivos;
}
