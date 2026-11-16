"use server";

import { revalidatePath } from "next/cache";
import { exigirRepartidor } from "@/lib/reparto/server";
import type { SolicitudConCobro } from "@/app/(admin)/admin/rutas/entrega-actions";
import type { SolicitudEntregaFallida } from "@/app/(admin)/admin/rutas/fallida-actions";
import type { RespuestaConfirmacion } from "@/app/(admin)/admin/rutas/entrega-confirmacion";
import type { DatosVistaEntrega } from "@/app/(admin)/admin/rutas/entrega-preview";
import { solicitudValida, cobroValido, leerBalanceEntrega } from "@/app/(admin)/admin/rutas/entrega-validacion";

export type AmbitoEntregaReparto = { ruta?: string; fecha: string; asignacion: number };
const faltaSQL = "Entrega y cobro compartidos requieren instalar supabase/manual/reparto_entrega_compartida.sql. No se confirmó esta operación.";
async function operar(ambito: AmbitoEntregaReparto, accion: string, solicitud: unknown) {
  const db = await exigirRepartidor();
  const { data, error } = await db.rpc("operar_entrega_asignada", { p_ambito: ambito, p_accion: accion, p_solicitud: solicitud });
  if (error) return { error: ["PGRST202", "42883"].includes(error.code) ? faltaSQL
    : "No fue posible verificar la operación. La asignación, versión o instalación pueden haber cambiado. Conserva la misma solicitud y actualiza la ruta." };
  return { data };
}
export async function cargarVistaReparto(ambito: AmbitoEntregaReparto, pedido: string, version: number): Promise<{ datos?: DatosVistaEntrega; error?: string }> {
  const r = await operar(ambito, "vista", { p_pedido_id: pedido, p_version_esperada: version });
  if (r.error) return { error: r.error };
  if (!r.data?.resumen?.solicitud || r.data.resumen.solicitud.p_pedido_id !== pedido || r.data.resumen.solicitud.p_version_esperada !== version ||
      !solicitudValida(r.data.resumen.solicitud) || !Array.isArray(r.data.reglas) || !Array.isArray(r.data.resumen.productos) ||
      !Number.isSafeInteger(r.data.aplicadoPrevio) || r.data.aplicadoPrevio < 0) return { error: "Vista de entrega incompatible. Requiere revisión de la instalación." };
  const datos = r.data as DatosVistaEntrega;
  const { resumen, reglas } = datos;
  if (![resumen.subtotal, resumen.costoEntrega, resumen.descuento, resumen.total].every(n => Number.isSafeInteger(n) && n >= 0) ||
      resumen.total !== resumen.subtotal + resumen.costoEntrega - resumen.descuento ||
      resumen.productos.length !== reglas.length || resumen.productos.some(p => !p || typeof p.nombre !== "string" || typeof p.unidad !== "string" ||
        !Number.isFinite(p.cantidad) || p.cantidad < 0 || !Number.isSafeInteger(p.importe) || p.importe < 0 || !reglas.some(r => r?.id === p.id)) ||
      resumen.subtotal !== resumen.productos.reduce((sum, p) => sum + p.importe, 0)) return { error: "Importes de preparación incompatibles. Requiere revisión de la instalación." };
  return { datos };
}
export async function resolverEntregaReparto(ambito: AmbitoEntregaReparto, s: SolicitudConCobro, diferencias: boolean, consultar = false): Promise<RespuestaConfirmacion> {
  if (!solicitudValida(s) || !cobroValido(s) || typeof diferencias !== "boolean" || typeof consultar !== "boolean") return { error: "Los datos de entrega o cobro no son válidos." };
  const r = await operar(ambito, consultar ? "consultar" : "confirmar", { ...s, p_diferencias: diferencias });
  if (r.error) return { error: r.error };
  if (r.data?.confirmada === true && r.data.misma_solicitud === false) { actualizar(); return { yaEntregado: true }; }
  const balance = leerBalanceEntrega(r.data?.resultado);
  if (r.data?.confirmada !== true || r.data.misma_solicitud !== true || !balance || r.data.resultado?.pedido_id !== s.p_pedido_id || r.data.resultado.estado !== "entregado") return { error: "Aún no hay comprobante confirmado visible. Conserva la misma solicitud para reintentar." };
  actualizar();
  return { resultado: balance, recuperada: r.data.reintento === true };
}
export async function registrarFallidaReparto(ambito: AmbitoEntregaReparto, s: SolicitudEntregaFallida, confirmacion: boolean): Promise<{ exito?: boolean; error?: string }> {
  if (confirmacion !== true) return { error: "Confirma explícitamente el intento fallido." };
  const r = await operar(ambito, "fallida", s);
  if (r.error) return { error: r.error };
  if (r.data?.resultado?.pedido_id !== s.p_pedido_id || r.data.resultado.estado !== "entrega_fallida") return { error: "Respuesta sin verificar. Reintenta con la misma solicitud." };
  actualizar(); return { exito: true };
}
function actualizar() {
  for (const ruta of ["/reparto", "/admin/rutas", "/admin/pedidos", "/admin/clientes", "/mi-cuenta/pedidos"]) {
    try { revalidatePath(ruta, "layout"); } catch { /* El comprobante no depende del refresh. */ }
  }
}
