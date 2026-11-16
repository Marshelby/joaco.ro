import { DeliveryProductsSummary } from "@/components/admin/delivery-products-summary";
import { DayPurchaseRow } from "@/components/admin/day-purchase-row";
import { leerComprasDia } from "@/lib/admin/compras-dia";
import type { ResumenProductoEntrega } from "@/lib/admin/pedidos";

export async function DayPurchasesSummary({ fecha, productos }: { fecha: string; productos: readonly ResumenProductoEntrega[] }) {
  const datos = await leerComprasDia(fecha);
  const activas = datos?.productos.filter(p => p.clave_operativa !== null) ?? [];
  const porClave = new Map(activas.map(p => [p.clave_operativa, p]));
  const coincide = datos !== null && porClave.size === activas.length && productos.length === activas.length &&
    productos.every(p => {
      const fila = porClave.get(p.clave);
      return fila !== undefined && Math.round(fila.requerida * 1000) === Math.round(p.cantidadTotal * 1000);
    });
  if (!coincide || !datos) return <div className="space-y-3"><p role="alert" className="text-sm text-amber-800">Compras del día no disponibles. Recarga: la demanda pudo cambiar o falta verificar el SQL manual. No se presume costo cero.</p><DeliveryProductsSummary productos={productos} variant="compact" /></div>;
  if (!datos.productos.length) return <p className="text-sm text-muted-foreground">No hay productos requeridos para esta fecha.</p>;
  return <div className="space-y-3"><p className="text-xs text-muted-foreground">Compras del {fecha}. Cada presentación se registra por separado, sin conversiones.</p>{datos.contrato === 1 && <p className="text-xs text-amber-800">Instalación anterior: una compra por producto. Las compras independientes y la utilidad requieren el parche incremental pendiente.</p>}<ul className="grid gap-x-5 sm:grid-cols-2 xl:grid-cols-3">{datos.productos.map(p => <DayPurchaseRow key={`${fecha}-${p.clave}-${p.revision}-${JSON.stringify(p.compras ?? p.version)}`} producto={p} fecha={fecha} />)}</ul></div>;
}
