import type { HomeSectionMock } from "@/types/home-section";
import type { MockProduct } from "@/types/product";

export type ResolvedHomeSection = Omit<HomeSectionMock, "productIds"> & {
  products: readonly MockProduct[];
};

export function resolveHomeSections(sections: readonly HomeSectionMock[], products: readonly MockProduct[]): readonly ResolvedHomeSection[] {
  const productsById = new Map(products.map((product) => [product.id, product]));

  return sections.map((section) => ({
    id: section.id,
    title: section.title,
    description: section.description,
    products: section.productIds.flatMap((id) => {
      const product = productsById.get(id);
      return product ? [product] : [];
    }),
  }));
}
