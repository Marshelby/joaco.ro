import "server-only";
import { exigirAdminReparto } from "@/lib/reparto/server";

export type ContabilidadRutaPedido = {
  regimen: string;
  venta_reconocida: boolean;
  importe_definitivo: number | null;
  total_aplicado: number | null;
  saldo_pedido: number | null;
  aplicaciones: { metodo: string; monto: number }[];
};
export type ContabilidadRutas = Record<string, ContabilidadRutaPedido>;

// No fallback N+1 ni conversión de errores en saldos cero.
export async function obtenerContabilidadRutas(fecha: string, ids: string[]): Promise<ContabilidadRutas | null> {
  const db = await exigirAdminReparto();
  const { data, error } = await db.rpc("leer_resumen_contable_rutas_admin", { p_fecha: fecha });
  if (error || !data || typeof data !== "object" || Array.isArray(data)) return null;
  if (Object.keys(data).length !== new Set(ids).size) return null;
  const resultado: ContabilidadRutas = {};
  for (const id of new Set(ids)) {
    const r = data[id];
    if (!r || typeof r.regimen !== "string" || typeof r.venta_reconocida !== "boolean" ||
      ![r.importe_definitivo, r.total_aplicado, r.saldo_pedido].every(n => n === null || (Number.isSafeInteger(n) && n >= 0)) ||
      !Array.isArray(r.aplicaciones) || !r.aplicaciones.every((a: { metodo?: unknown; monto?: unknown }) => typeof a?.metodo === "string" && typeof a.monto === "number" && Number.isSafeInteger(a.monto) && a.monto >= 0)) return null;
    if (r.venta_reconocida && (r.importe_definitivo === null || r.total_aplicado === null || r.saldo_pedido === null ||
      r.importe_definitivo - r.total_aplicado !== r.saldo_pedido ||
      r.aplicaciones.reduce((s: number, a: { monto: number }) => s + a.monto, 0) !== r.total_aplicado)) return null;
    resultado[id] = r;
  }
  return resultado;
}
