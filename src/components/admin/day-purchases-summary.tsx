import { bloqueJornada, importeJornada, tonoJornada } from "@/components/admin/jornada-colores";
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
  if (!coincide || !datos) return <div className="space-y-3"><p role="alert" className={`${bloqueJornada} text-sm ${tonoJornada.informativo}`}>Compras del día no disponibles. Recarga: la demanda pudo cambiar o falta verificar el SQL manual. No se presume costo cero.</p><DeliveryProductsSummary productos={productos} variant="compact" cantidadClassName={`min-w-0 wrap-break-word text-right text-sm ${importeJornada} ${tonoJornada.planificado}`} /></div>;
  if (!datos.productos.length) return <p className="text-sm text-muted-foreground">No hay productos requeridos para esta fecha.</p>;
  return <div className="space-y-3"><p className="text-xs text-muted-foreground">Compras del {fecha}. Cada presentación se registra por separado, sin conversiones.</p>{datos.contrato === 1 && <p className={`${bloqueJornada} text-xs ${tonoJornada.informativo}`}>Instalación anterior: una compra por producto. Las compras independientes y la utilidad requieren el parche incremental pendiente.</p>}{datos.contrato === 2 && <p className="text-xs text-muted-foreground">La vinculación con proveedores estará disponible al instalar el SQL incremental de fase 3.</p>}<ul className="grid gap-x-5 sm:grid-cols-2 xl:grid-cols-3">{datos.productos.map(p => <DayPurchaseRow key={`${fecha}-${p.clave}-${p.revision}-${JSON.stringify(p.compras ?? p.version)}`} producto={p} fecha={fecha} proveedores={datos.contrato === 3 ? datos.proveedores : undefined} />)}</ul></div>;
}
