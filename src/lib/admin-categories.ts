import { normalizeCatalogText } from "@/lib/catalog";
import type { CatalogCategoryMock } from "@/types/category";

function compareNames(left: string, right: string) {
  return left.localeCompare(right, "es");
}

export function getAdminCategories(categories: readonly CatalogCategoryMock[]) {
  return categories
    .map((category) => ({
      ...category,
      subcategories: [...category.subcategories].sort((left, right) => compareNames(left.name, right.name)),
    }))
    .sort((left, right) => compareNames(left.name, right.name));
}

export function searchAdminCategories(categories: readonly CatalogCategoryMock[], query: string) {
  const normalizedQuery = normalizeCatalogText(query);

  if (!normalizedQuery) {
    return categories;
  }

  return categories.filter((category) => {
    const searchableText = [category.name, ...category.subcategories.map((subcategory) => subcategory.name)].join(" ");

    return normalizeCatalogText(searchableText).includes(normalizedQuery);
  });
}
