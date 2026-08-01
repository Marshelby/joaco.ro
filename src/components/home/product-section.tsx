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
};

export function ProductSection({
  id,
  eyebrow,
  title,
  description,
  products,
  countLabel,
}: ProductSectionProps) {
  return (
    <section aria-labelledby={id} className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
        <div id={id}>
          <SectionTitle eyebrow={eyebrow} title={title} description={description} />
        </div>
        {countLabel ? <p className="text-sm text-muted-foreground">{countLabel}</p> : null}
      </div>
      <ProductGrid products={products} />
    </section>
  );
}
