import type { ItemPedidoCuenta } from "@/lib/account/pedidos";
import { CatalogImage } from "@/components/media/catalog-image";
import { formatCLP } from "@/lib/formatters";

function formatQuantity(cantidad: number, unidad: string) {
  const value = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 3 }).format(cantidad);
  return unidad.toUpperCase() === "KG" ? `${value} kg` : `${value} ${unidad}`;
}

export function OrderItemRow({ item }: { item: ItemPedidoCuenta }) {
  return (
    <li className="grid grid-cols-[3.5rem_minmax(0,1fr)_auto] items-start gap-3 py-4 first:pt-0 last:pb-0 sm:grid-cols-[4rem_minmax(0,1fr)_auto] sm:gap-4">
      <div className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-muted sm:size-16">
        <CatalogImage image={item.rutaImagen ? { src: item.rutaImagen, alt: "", fit: "contain" } : undefined} fallback="package" sizes="(min-width: 640px) 64px, 56px" fallbackIconClassName="size-6" />
      </div>
      <div className="min-w-0">
        <h3 className="font-medium leading-5 text-foreground">{item.nombreProductoSnapshot}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{item.nombrePresentacionSnapshot ?? item.unidadSnapshot}</p>
        <p className="mt-1 text-sm text-muted-foreground">{formatQuantity(item.cantidad, item.unidadSnapshot)} × {formatCLP(item.precioFinalUnitarioSnapshot)}</p>
      </div>
      <p className="shrink-0 text-sm font-semibold text-foreground">{formatCLP(item.totalLinea)}</p>
    </li>
  );
}
