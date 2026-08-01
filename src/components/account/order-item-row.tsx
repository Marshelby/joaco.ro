import { CatalogImage } from "@/components/media/catalog-image";
import { formatCLP } from "@/lib/formatters";
import type { OrderItemSnapshot } from "@/types/account";

export function OrderItemRow({ item }: { item: OrderItemSnapshot }) {
  return (
    <li className="flex gap-4 py-4 first:pt-0 last:pb-0">
      <div className="relative size-16 shrink-0 overflow-hidden rounded-lg border border-border bg-muted sm:size-20">
        <CatalogImage image={item.productImage} fallback={item.productImageFallback} sizes="80px" fallbackIconClassName="size-7 sm:size-8" />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="font-medium leading-5 text-foreground">{item.productName}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{item.quantity} {item.quantity === 1 ? "unidad" : "unidades"} × {formatCLP(item.unitPrice)}</p>
      </div>
      <p className="shrink-0 text-sm font-semibold text-foreground">{formatCLP(item.lineTotal)}</p>
    </li>
  );
}
