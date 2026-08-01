import { normalizeCatalogText } from "@/lib/catalog";
import type { MockProduct } from "@/types/product";

export function getAdminProducts(products: readonly MockProduct[]) {
  return [...products].sort((first, second) => first.name.localeCompare(second.name, "es-CL"));
}

export function searchAdminProducts(products: readonly MockProduct[], query: string) {
  const normalizedQuery = normalizeCatalogText(query);

  if (!normalizedQuery) return products;

  return products.filter((product) =>
    normalizeCatalogText([product.name, product.category, product.subcategory].filter(Boolean).join(" ")).includes(normalizedQuery),
  );
}

export function getAdminProductById(products: readonly MockProduct[], id: string) {
  return products.find((product) => product.id === id);
}
