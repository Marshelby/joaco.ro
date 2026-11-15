import { exigirAdminReparto } from "@/lib/reparto/server";
import { DeliveryProductsSummary } from "@/components/admin/delivery-products-summary";
import { DayPurchaseRow, type ProductoCompraDia } from "@/components/admin/day-purchase-row";
import type { ResumenProductoEntrega } from "@/lib/admin/pedidos";

function esProducto(val: unknown): val is ProductoCompraDia {
  if (!val || typeof val !== "object") return false;
  const p = val as ProductoCompraDia;
  return typeof p.clave_operativa === "string" && typeof p.requiere_ajuste === "boolean" &&
    (p.actualizado === null || typeof p.actualizado === "string") &&
    typeof p.clave === "string" && /^[a-f0-9]{32}$/.test(p.clave) &&
    typeof p.revision === "string" && /^[a-f0-9]{32}$/.test(p.revision) &&
    typeof p.producto === "string" && (p.presentacion === null || typeof p.presentacion === "string") &&
    typeof p.unidad === "string" && typeof p.modo === "string" &&
    Number.isFinite(p.requerida) && p.requerida >= 0 &&
    (p.asignada === null || (Number.isFinite(p.asignada) && p.asignada >= 0 && p.asignada <= p.requerida && p.asignada < 1000000000)) &&
    (p.precio === null || (Number.isFinite(p.precio) && p.precio >= 0 && p.precio < 1000000000)) &&
    Number.isSafeInteger(p.version) && p.version >= 0 &&
    ((p.version === 0 && p.asignada === null && p.precio === null) || (p.version > 0 && p.asignada !== null && (p.precio !== null || p.requiere_ajuste)));
}

export async function DayPurchasesSummary({ fecha, productos }: { fecha: string; productos: readonly ResumenProductoEntrega[] }) {
  const db = await exigirAdminReparto();
  const { data, error } = await db.rpc("leer_costos_productos_dia", { p_fecha: fecha });
  // Ambas lecturas deben representar el mismo resumen operativo. Si hubo un
  // cambio entre consultas, no mezclar cantidades ni habilitar la edición.
  const filasValidas = !error && data?.contrato === 1 && Array.isArray(data.productos) && data.productos.every(esProducto)
    ? data.productos as ProductoCompraDia[] : null;
  const porClave = new Map(filasValidas?.map(p => [p.clave_operativa, p]));
  const coincide = filasValidas !== null && new Set(filasValidas.map(p => p.clave)).size === filasValidas.length &&
    porClave.size === filasValidas.length && productos.length === filasValidas.length &&
    productos.every(p => {
      const fila = porClave.get(p.clave);
      return fila !== undefined && Math.round(fila.requerida * 1000) === Math.round(p.cantidadTotal * 1000);
    });
  if (!coincide || !filasValidas) {
    return <div className="space-y-3"><p role="alert" className="text-sm text-amber-800">Compras del día no disponibles. Recarga: la demanda pudo cambiar o falta instalar/verificar el SQL manual de Fase 1. No se presume cobertura ni costo cero.</p><DeliveryProductsSummary productos={productos} variant="compact" /></div>;
  }
  const filas = filasValidas;
  if (!filas.length) return <p className="text-sm text-muted-foreground">No hay productos requeridos para esta fecha.</p>;
  return <div className="space-y-3"><p className="text-xs text-muted-foreground">Compras asignadas al {fecha}. Cada presentación se registra por separado, sin conversiones.</p><ul className="grid gap-x-5 sm:grid-cols-2 xl:grid-cols-3">{filas.map(p => <DayPurchaseRow key={`${fecha}-${p.clave}-${p.version}-${p.revision}`} producto={p} fecha={fecha} />)}</ul></div>;
}
