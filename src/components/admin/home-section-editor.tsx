import { HomeSectionCard } from "@/components/admin/home-section-card";
import type { AdminHomeSection, AdminHomeSectionCandidate } from "@/lib/admin-home-sections";

export function HomeSectionEditor({ sections, products }: { sections: readonly AdminHomeSection[]; products: readonly AdminHomeSectionCandidate[] }) {
  return (
    <div className="space-y-5">
      {sections.map((section) => <HomeSectionCard key={section.slug} section={section} allProducts={products} />)}
    </div>
  );
}
