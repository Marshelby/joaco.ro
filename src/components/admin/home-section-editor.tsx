import { HomeSectionCard } from "@/components/admin/home-section-card";
import type { ResolvedHomeSection } from "@/lib/admin-home-sections";
import type { MockProduct } from "@/types/product";

export function HomeSectionEditor({ sections, products }: { sections: readonly ResolvedHomeSection[]; products: readonly MockProduct[] }) {
  return (
    <div className="space-y-5">
      {sections.map((section) => <HomeSectionCard key={section.id} section={section} allProducts={products} />)}
    </div>
  );
}
