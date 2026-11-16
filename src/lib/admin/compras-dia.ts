import "server-only";
import { cache } from "react";
import { exigirAdminReparto } from "@/lib/reparto/server";
import type { ProductoCompraDia } from "@/components/admin/day-purchase-row";

const monto = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= Number.MAX_SAFE_INTEGER;
const hash = (s: unknown): s is string => typeof s === "string" && /^[a-f0-9]{32}$/.test(s);
function esProducto(val: unknown, multiple: boolean): val is ProductoCompraDia {
  if (!val || typeof val !== "object") return false;
  const p = val as ProductoCompraDia;
  if (!hash(p.clave) || !hash(p.revision) || typeof p.producto !== "string" ||
    !(p.presentacion === null || typeof p.presentacion === "string") || typeof p.unidad !== "string" || typeof p.modo !== "string" ||
    typeof p.requiere_ajuste !== "boolean" || !(p.clave_operativa === null || typeof p.clave_operativa === "string") ||
    !monto(p.requerida) || !(p.asignada === null || (monto(p.asignada) && p.asignada <= p.requerida)) ||
    !(p.precio === null || monto(p.precio)) || !Number.isSafeInteger(p.version) || p.version < 0) return false;
  if (!multiple) return typeof p.clave_operativa === "string" &&
    ((p.version === 0 && p.asignada === null && p.precio === null) || (p.version > 0 && p.asignada !== null && (p.precio !== null || p.requiere_ajuste)));
  return monto(p.comprada) && monto(p.venta) && (p.venta_reconocida === null || monto(p.venta_reconocida)) &&
    typeof p.sin_desglose === "number" && Number.isSafeInteger(p.sin_desglose) && p.sin_desglose >= 0 && (p.costo_total === null || monto(p.costo_total)) &&
    Array.isArray(p.compras) && p.compras.every(c => typeof c.id === "string" && /^[a-f0-9-]{36}$/i.test(c.id) &&
      monto(c.cantidad_asignada) && monto(c.precio_compra) && Number.isSafeInteger(c.version) && c.version > 0 && typeof c.actualizado_en === "string") &&
    new Set(p.compras.map(c => c.id)).size === p.compras.length;
}

export const leerComprasDia = cache(async (fecha: string): Promise<{ contrato: number; productos: ProductoCompraDia[]; proveedores?: { id: string; nombre: string }[] } | null> => {
  const db = await exigirAdminReparto();
  let respuesta = await db.rpc("leer_compras_productos_dia_v3", { p_fecha: fecha });
  if (respuesta.error && ["PGRST202", "42883"].includes(respuesta.error.code)) {
    respuesta = await db.rpc("leer_compras_productos_dia_v2", { p_fecha: fecha });
  }
  if (respuesta.error && ["PGRST202", "42883"].includes(respuesta.error.code)) {
    respuesta = await db.rpc("leer_costos_productos_dia", { p_fecha: fecha });
  }
  const { data, error } = respuesta;
  if (error || ![1, 2, 3].includes(data?.contrato) || !Array.isArray(data.productos) ||
    !data.productos.every((p: unknown) => esProducto(p, data.contrato >= 2)) ||
    (data.contrato === 3 && (!Array.isArray(data.proveedores) || !data.proveedores.every((v: { id?: unknown; nombre?: unknown }) => v && typeof v.id === "string" && /^[a-f0-9-]{36}$/i.test(v.id) && typeof v.nombre === "string") || !data.productos.every((p: ProductoCompraDia) => Array.isArray(p.compras) && p.compras.every(c => (c.proveedor_id === null || (typeof c.proveedor_id === "string" && /^[a-f0-9-]{36}$/i.test(c.proveedor_id))) && ["por_pagar", "pagado", "parcial"].includes(c.estado ?? "") && monto(c.pagado) && monto(c.total_contable) && c.pagado <= c.total_contable)))) ||
    new Set(data.productos.map((p: ProductoCompraDia) => p.clave)).size !== data.productos.length) return null;
  return data as { contrato: number; productos: ProductoCompraDia[]; proveedores?: { id: string; nombre: string }[] };
});
