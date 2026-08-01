import Link from "next/link";

import { CatalogImage } from "@/components/media/catalog-image";
import { ROUTES } from "@/config/routes";
import { formatCLP } from "@/lib/formatters";
import { getProductAvailabilityContent } from "@/lib/products";
import type { MockProduct } from "@/types/product";

type ProductCardProps = {
  product: MockProduct;
  variant?: "grid" | "rail";
};

export function ProductCard({ product, variant = "grid" }: ProductCardProps) {
  const wholesalePrice = product.wholesalePrice;
  const wholesaleMinimum = product.wholesaleMinimum;
  const hasWholesalePrice = wholesalePrice !== undefined && wholesaleMinimum !== undefined;

  return (
    <article className="h-full">
      <Link href={ROUTES.product(product.slug)} aria-label={`Ver ${product.name}`} className="group flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card outline-none transition duration-200 hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transform-none motion-reduce:transition-none">
        <div className={variant === "rail" ? "relative aspect-[16/10] overflow-hidden bg-muted/60" : "relative aspect-[4/3] overflow-hidden bg-muted/60"}>
          <CatalogImage
            image={product.image}
            fallback={product.imageFallback}
            sizes="(min-width: 1280px) 18rem, (min-width: 1024px) 22vw, (min-width: 640px) 33vw, 50vw"
            className="transition duration-300 group-hover:scale-[1.03] motion-reduce:transition-none"
          />
          {product.badge ? (
            <span className="absolute left-3 top-3 rounded-full bg-background/95 px-2.5 py-1 text-xs font-semibold text-foreground shadow-sm">
              {product.badge}
            </span>
          ) : null}
        </div>
        <div className={variant === "rail" ? "flex flex-1 flex-col p-4 sm:p-5" : "flex flex-1 flex-col p-4"}>
          <p className="text-xs font-medium text-muted-foreground">{product.category}</p>
          <h3 className="mt-1 text-base font-semibold leading-5 tracking-tight text-foreground">{product.name}</h3>
          <p className="mt-3 text-lg font-semibold tracking-tight text-foreground">{formatCLP(product.unitPrice)}</p>
          {hasWholesalePrice ? (
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Mayorista: {formatCLP(wholesalePrice)} desde {wholesaleMinimum} unidades
            </p>
          ) : null}
          <p className="mt-3 text-xs leading-5 text-muted-foreground">{getProductAvailabilityContent(product.availability).label}</p>
        </div>
      </Link>
    </article>
  );
}
