import { ActionLink } from "@/components/ui/action-link";
import { CatalogImage } from "@/components/media/catalog-image";
import { ROUTES } from "@/config/routes";
import { formatCLP } from "@/lib/formatters";
import type { ProductoAdmin } from "@/lib/admin/catalogo";

import { ProductStatusBadge } from "./product-status-badge";

export function ProductListItem({ product }: { product: ProductoAdmin }) {
  return (
    <li className="rounded-xl border border-border bg-card p-4 sm:p-5">
      <div className="grid grid-cols-[4rem_minmax(0,1fr)] gap-4 sm:grid-cols-[5rem_minmax(10rem,1.35fr)_minmax(7rem,0.8fr)_minmax(7rem,0.8fr)_minmax(10rem,0.95fr)_auto] sm:items-center sm:gap-5">
        <div className="relative size-16 overflow-hidden rounded-lg border border-border bg-muted sm:size-20">
          <CatalogImage
            image={product.rutaImagen ? { src: product.rutaImagen, alt: "", fit: "contain" } : undefined}
            fallback="package"
            sizes="(min-width: 640px) 80px, 64px"
            fallbackIconClassName="size-7 sm:size-9"
          />
        </div>
        <div className="min-w-0 self-center">
          <h2 className="text-base font-semibold tracking-tight text-foreground">{product.nombre}</h2>
        </div>
        <dl className="col-span-2 grid grid-cols-2 gap-4 border-t border-border pt-4 text-sm sm:col-span-1 sm:block sm:border-0 sm:p-0">
          <div><dt className="text-muted-foreground sm:sr-only">Categoría</dt><dd className="mt-1 font-medium text-foreground sm:mt-0">{product.categoria}</dd></div>
          <div className="sm:mt-2"><dt className="text-muted-foreground sm:sr-only">Presentación</dt><dd className="mt-1 text-muted-foreground sm:mt-0">{product.presentacion.nombre}</dd></div>
        </dl>
        <dl className="col-span-2 grid grid-cols-2 gap-4 text-sm sm:col-span-1 sm:block">
          <div><dt className="text-muted-foreground">Precio neto</dt><dd className="mt-1 font-medium text-foreground">{formatCLP(product.presentacion.precioNeto)}</dd></div>
          <div className="sm:mt-2"><dt className="text-muted-foreground">Precio con IVA</dt><dd className="mt-1 font-semibold text-foreground">{formatCLP(product.presentacion.precioFinal)}</dd></div>
          <div className="sm:mt-2"><dt className="text-muted-foreground">Unidad</dt><dd className="mt-1 font-medium text-foreground">{product.presentacion.cantidad} {product.presentacion.unidad}</dd></div>
        </dl>
        <div className="col-span-2 flex items-center justify-between gap-3 border-t border-border pt-4 sm:col-span-1 sm:block sm:border-0 sm:p-0">
          <div><span className="text-sm text-muted-foreground sm:sr-only">Estado</span><div className="mt-1 sm:mt-0"><ProductStatusBadge status={product.activo ? "active" : "hidden"} /></div></div>
          <ActionLink href={ROUTES.adminProduct(product.id)} variant="quiet" aria-label={`Editar ${product.nombre}`}>Editar</ActionLink>
        </div>
      </div>
    </li>
  );
}
