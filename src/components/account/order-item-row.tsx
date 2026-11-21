import type { ItemPedidoCuenta } from "@/lib/account/pedidos";
import { CatalogImage } from "@/components/media/catalog-image";
import { formatearCantidadPreparacionEntrega } from "@/lib/delivery-preparation-quantity";

export function OrderItemRow({ item }: { item: ItemPedidoCuenta }) {
  const formatQuantity = (cantidad: number) => formatearCantidadPreparacionEntrega(
    cantidad,
    item.nombrePresentacionSnapshot,
    item.unidadSnapshot,
    item.modoCantidadSnapshot,
  );
  const deliveredTone = item.cantidadEntregada === item.cantidad
    ? "bg-green-100 text-green-900"
    : "bg-orange-100 text-orange-900";

  return (
    <li className="grid grid-cols-[3.5rem_minmax(0,1fr)] items-start gap-x-3 gap-y-1 py-4 first:pt-0 last:pb-0 sm:grid-cols-[4rem_minmax(0,1fr)] sm:gap-x-4">
      <div className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-muted sm:size-16">
        <CatalogImage image={item.rutaImagen ? { src: item.rutaImagen, alt: "", fit: "contain" } : undefined} fallback="package" sizes="(min-width: 640px) 64px, 56px" fallbackIconClassName="size-6" />
      </div>
      <div className="min-w-0">
        <h3 className="break-words text-sm font-medium leading-5 text-foreground">{item.nombreProductoSnapshot}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{item.nombrePresentacionSnapshot ?? item.unidadSnapshot}</p>
        <div className="mt-2 flex flex-wrap gap-2 text-xs font-medium tabular-nums">
          <span className="rounded-md bg-gray-100 px-2 py-1 text-gray-900">
            Solicitado {formatQuantity(item.cantidad)}
          </span>
          {item.cantidadEntregada !== null ? (
            <span className={`rounded-md px-2 py-1 ${deliveredTone}`}>
              Entregado {formatQuantity(item.cantidadEntregada)}
            </span>
          ) : null}
        </div>
      </div>
    </li>
  );
}
