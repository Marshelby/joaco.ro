import type { MockProduct } from "@/types/product";

export const CATALOG_SORT_OPTIONS = [
  { value: "recommended", label: "Recomendados" },
  { value: "price-asc", label: "Precio: menor a mayor" },
  { value: "price-desc", label: "Precio: mayor a menor" },
  { value: "newest", label: "Novedades" },
] as const;

export type CatalogSort = (typeof CATALOG_SORT_OPTIONS)[number]["value"];

export type CatalogFilters = {
  query: string;
  category?: string;
  sort: CatalogSort;
};

export type CatalogSearchParams = Record<string, string | string[] | undefined>;

const defaultSort: CatalogSort = "recommended";

function getSearchParamValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function normalizeCatalogText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-CL")
    .trim();
}

export function getCatalogCategoryParam(category: string) {
  return normalizeCatalogText(category).replace(/\s+/g, "-");
}

export function parseCatalogFilters(
  searchParams: CatalogSearchParams,
  categories: readonly string[],
): CatalogFilters {
  const query = getSearchParamValue(searchParams.q)?.trim() ?? "";
  const categoryParam = getSearchParamValue(searchParams.categoria);
  const category = categories.find(
    (item) => getCatalogCategoryParam(item) === categoryParam,
  );
  const sortParam = getSearchParamValue(searchParams.orden);
  const sort = CATALOG_SORT_OPTIONS.some((option) => option.value === sortParam)
    ? (sortParam as CatalogSort)
    : defaultSort;

  return { query, category, sort };
}

export function getCatalogHref(filters: Partial<CatalogFilters>) {
  const params = new URLSearchParams();
  const query = filters.query?.trim();

  if (query) params.set("q", query);
  if (filters.category) params.set("categoria", getCatalogCategoryParam(filters.category));
  if (filters.sort && filters.sort !== defaultSort) params.set("orden", filters.sort);

  const search = params.toString();
  return search ? `/catalogo?${search}` : "/catalogo";
}

export function filterCatalogProducts(
  products: readonly MockProduct[],
  filters: Pick<CatalogFilters, "query" | "category">,
) {
  const normalizedQuery = normalizeCatalogText(filters.query);

  return products.filter((product) => {
    const matchesCategory = !filters.category || product.category === filters.category;
    const searchableText = normalizeCatalogText(
      [product.name, product.category, product.subcategory, product.badge]
        .filter(Boolean)
        .join(" "),
    );

    return matchesCategory && (!normalizedQuery || searchableText.includes(normalizedQuery));
  });
}

export function sortCatalogProducts(
  products: readonly MockProduct[],
  sort: CatalogSort,
) {
  return [...products].sort((first, second) => {
    if (sort === "price-asc") return first.unitPrice - second.unitPrice;
    if (sort === "price-desc") return second.unitPrice - first.unitPrice;
    if (sort === "newest") return Number(second.newArrival) - Number(first.newArrival) || first.name.localeCompare(second.name, "es-CL");

    return Number(second.featured) - Number(first.featured) || first.name.localeCompare(second.name, "es-CL");
  });
}
