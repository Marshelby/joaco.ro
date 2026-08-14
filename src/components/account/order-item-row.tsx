import type { ItemPedidoCuenta } from "@/lib/account/pedidos";
import { formatCLP } from "@/lib/formatters";

function formatQuantity(cantidad: number, unidad: string) {
  const value = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 3 }).format(cantidad);
  return unidad.toUpperCase() === "KG" ? `${value} kg` : `${value} ${unidad}`;
}

export function OrderItemRow({ item }: { item: ItemPedidoCuenta }) {
  return (
    <li className="flex items-start justify-between gap-4 py-4 first:pt-0 last:pb-0">
      <div className="min-w-0 flex-1">
        <h3 className="font-medium leading-5 text-foreground">{item.nombreProductoSnapshot}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{item.nombrePresentacionSnapshot ?? item.unidadSnapshot}</p>
        <p className="mt-1 text-sm text-muted-foreground">{formatQuantity(item.cantidad, item.unidadSnapshot)} × {formatCLP(item.precioFinalUnitarioSnapshot)}</p>
      </div>
      <p className="shrink-0 text-sm font-semibold text-foreground">{formatCLP(item.totalLinea)}</p>
    </li>
  );
}
