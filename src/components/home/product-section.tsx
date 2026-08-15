import { ProductGrid } from "@/components/home/product-grid";
import { SectionTitle } from "@/components/home/section-title";
import type { MockProduct } from "@/types/product";

type ProductSectionProps = {
  id: string;
  eyebrow?: string;
  title: string;
  description: string;
  products: readonly MockProduct[];
  countLabel?: string;
  gridVariant?: "home" | "catalog";
};

export function ProductSection({
  id,
  eyebrow,
  title,
  description,
  products,
  countLabel,
  gridVariant,
}: ProductSectionProps) {
  return (
    <section aria-labelledby={id} className="min-w-0 max-w-full space-y-8">
      <div className="flex min-w-0 max-w-full flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
        <div id={id} className="min-w-0 max-w-full">
          <SectionTitle eyebrow={eyebrow} title={title} description={description} />
        </div>
        {countLabel ? <p className="text-sm text-muted-foreground">{countLabel}</p> : null}
      </div>
      <ProductGrid products={products} variant={gridVariant} />
    </section>
  );
}
