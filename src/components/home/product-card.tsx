import Link from "next/link";

import { CatalogImage } from "@/components/media/catalog-image";
import { ROUTES } from "@/config/routes";
import { formatCLP } from "@/lib/formatters";
import { getProductAvailabilityContent, getProductSaleUnitLabel } from "@/lib/products";
import type { MockProduct } from "@/types/product";

type ProductCardProps = {
  product: MockProduct;
  variant?: "grid" | "rail";
};

export function ProductCard({ product, variant = "grid" }: ProductCardProps) {
  return (
    <article className="h-full">
      <Link href={ROUTES.product(product.slug)} aria-label={`Ver ${product.name}`} className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border/70 bg-card outline-none transition duration-200 hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transform-none motion-reduce:transition-none">
        <div className={variant === "rail" ? "relative aspect-[4/3] min-h-[190px] overflow-hidden bg-white p-1.5" : "relative aspect-[4/3] overflow-hidden bg-white p-1.5"}>
          <CatalogImage
            image={product.image}
            fallback={product.imageFallback}
            sizes="(min-width: 1280px) 18rem, (min-width: 1024px) 22vw, (min-width: 640px) 33vw, 50vw"
            className="transition duration-300 group-hover:scale-[1.025] motion-reduce:transition-none"
          />
          {product.badge ? (
            <span className="absolute left-2.5 top-2.5 rounded-full bg-background/95 px-2.5 py-1 text-xs font-semibold text-foreground shadow-sm">
              {product.badge}
            </span>
          ) : null}
        </div>
        <div className={variant === "rail" ? "flex flex-1 flex-col p-4 sm:p-5" : "flex flex-1 flex-col p-4"}>
          <p className="text-xs font-medium tracking-wide text-muted-foreground">{product.category}</p>
          <h3 className="mt-1.5 text-base font-semibold leading-5 tracking-tight text-foreground">{product.name}</h3>
          <p className="mt-4 text-xl font-semibold tracking-tight text-foreground">{formatCLP(product.unitPrice)}</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{getProductSaleUnitLabel(product.saleUnit)}</p>
          <p className="mt-3 text-xs leading-5 text-muted-foreground">{getProductAvailabilityContent(product.availability).label}</p>
        </div>
      </Link>
    </article>
  );
}
