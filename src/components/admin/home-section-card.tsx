import { HomeSectionProductRow } from "@/components/admin/home-section-product-row";
import { HomeSectionToolbar } from "@/components/admin/home-section-toolbar";
import type { ResolvedHomeSection } from "@/lib/admin-home-sections";
import type { MockProduct } from "@/types/product";

export function HomeSectionCard({ section, allProducts }: { section: ResolvedHomeSection; allProducts: readonly MockProduct[] }) {
  return (
    <section aria-labelledby={`home-section-${section.id}`} className="overflow-visible rounded-xl border border-border bg-card">
      <header className="flex flex-col gap-4 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="space-y-1">
          <h2 id={`home-section-${section.id}`} className="text-lg font-semibold tracking-tight text-foreground">{section.title}</h2>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{section.description}</p>
        </div>
        <HomeSectionToolbar products={allProducts} sectionTitle={section.id} />
      </header>
      <ol className="divide-y divide-border">
        {section.products.map((product, index) => <HomeSectionProductRow key={product.id} product={product} position={index + 1} />)}
      </ol>
    </section>
  );
}
