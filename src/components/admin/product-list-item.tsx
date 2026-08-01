import { CatalogImage } from "@/components/media/catalog-image";
import { ActionLink } from "@/components/ui/action-link";
import { ROUTES } from "@/config/routes";
import { formatCLP } from "@/lib/formatters";
import type { MockProduct } from "@/types/product";

import { ProductStatusBadge } from "./product-status-badge";

export function ProductListItem({ product }: { product: MockProduct }) {
  const wholesalePrice = product.wholesalePrice;
  const wholesaleMinimum = product.wholesaleMinimum;
  const wholesaleDetail = wholesalePrice !== undefined && wholesaleMinimum !== undefined
    ? `${formatCLP(wholesalePrice)} desde ${wholesaleMinimum}`
    : "No disponible";

  return (
    <li className="rounded-xl border border-border bg-card p-4 sm:p-5">
      <div className="grid grid-cols-[4rem_minmax(0,1fr)] gap-4 sm:grid-cols-[5rem_minmax(10rem,1.35fr)_minmax(7rem,0.8fr)_minmax(7rem,0.8fr)_minmax(10rem,0.95fr)_auto] sm:items-center sm:gap-5">
        <div className="relative size-16 overflow-hidden rounded-lg border border-border bg-muted sm:size-20">
          <CatalogImage image={product.image} fallback={product.imageFallback} sizes="80px" fallbackIconClassName="size-7 sm:size-8" />
        </div>
        <div className="min-w-0 self-center">
          <h2 className="text-base font-semibold tracking-tight text-foreground">{product.name}</h2>
        </div>
        <dl className="col-span-2 grid grid-cols-2 gap-4 border-t border-border pt-4 text-sm sm:col-span-1 sm:block sm:border-0 sm:p-0">
          <div><dt className="text-muted-foreground sm:sr-only">Categoría</dt><dd className="mt-1 font-medium text-foreground sm:mt-0">{product.category}</dd></div>
          <div className="sm:mt-2"><dt className="text-muted-foreground sm:sr-only">Subcategoría</dt><dd className="mt-1 text-muted-foreground sm:mt-0">{product.subcategory ?? "Sin subcategoría"}</dd></div>
        </dl>
        <dl className="col-span-2 grid grid-cols-2 gap-4 text-sm sm:col-span-1 sm:block">
          <div><dt className="text-muted-foreground">Precio unitario</dt><dd className="mt-1 font-semibold text-foreground">{formatCLP(product.unitPrice)}</dd></div>
          <div className="sm:mt-2"><dt className="text-muted-foreground">Precio mayorista</dt><dd className="mt-1 font-medium text-foreground">{wholesaleDetail}</dd></div>
        </dl>
        <div className="col-span-2 flex items-center justify-between gap-3 border-t border-border pt-4 sm:col-span-1 sm:block sm:border-0 sm:p-0">
          <div><span className="text-sm text-muted-foreground sm:sr-only">Estado</span><div className="mt-1 sm:mt-0"><ProductStatusBadge status={product.adminStatus} /></div></div>
          <ActionLink href={ROUTES.adminProduct(product.id)} variant="quiet" aria-label={`Editar ${product.name}`}>Editar</ActionLink>
        </div>
      </div>
    </li>
  );
}
