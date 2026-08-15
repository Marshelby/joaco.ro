import { ProductCard } from "@/components/home/product-card";
import type { MockProduct } from "@/types/product";

type ProductGridProps = {
  products: readonly MockProduct[];
  variant?: "home" | "catalog";
};

export function ProductGrid({ products, variant = "home" }: ProductGridProps) {
  return (
    <div className={variant === "catalog" ? "grid min-w-0 max-w-full grid-cols-1 gap-4 min-[360px]:grid-cols-2 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 lg:gap-5" : "grid min-w-0 max-w-full grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 lg:gap-5"}>
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
