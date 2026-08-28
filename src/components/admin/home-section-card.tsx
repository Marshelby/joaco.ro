import { HomeSectionProductRow } from "@/components/admin/home-section-product-row";
import { HomeSectionToolbar } from "@/components/admin/home-section-toolbar";
import type { AdminHomeSection, AdminHomeSectionCandidate } from "@/lib/admin-home-sections";

export function HomeSectionCard({ section, allProducts }: { section: AdminHomeSection; allProducts: readonly AdminHomeSectionCandidate[] }) {
  return (
    <section aria-labelledby={`home-section-${section.slug}`} className="overflow-visible rounded-xl border border-border bg-card">
      <header className="flex flex-col gap-4 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="space-y-1">
          <h2 id={`home-section-${section.slug}`} className="text-lg font-semibold tracking-tight text-foreground">{section.title}</h2>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{section.description}</p>
        </div>
        <HomeSectionToolbar products={allProducts} sectionSlug={section.slug} assignedProductIds={section.products.map((product) => product.productId)} />
      </header>
      <ol className="divide-y divide-border">
        {section.products.map((product, index) => <HomeSectionProductRow key={product.assignmentId} product={product} position={index + 1} canMoveUp={index > 0} canMoveDown={index < section.products.length - 1} />)}
      </ol>
    </section>
  );
}
