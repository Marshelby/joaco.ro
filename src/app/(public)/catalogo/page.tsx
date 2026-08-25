import type { Metadata } from "next";
import { CatalogToolbar } from "@/components/catalog/catalog-toolbar";
import { EmptyState } from "@/components/feedback/empty-state";
import { ProductGrid } from "@/components/home/product-grid";
import { Container } from "@/components/layout/container";
import { PageHeader } from "@/components/shared/page-header";
import { ActionLink } from "@/components/ui/action-link";
import { filterCatalogProducts, parseCatalogFilters, sortCatalogProducts, type CatalogCategory, type CatalogSearchParams } from "@/lib/catalog";
import { getStorefrontCategories, getStorefrontProducts } from "@/lib/storefront-catalog";

export const metadata: Metadata = { title: "Catálogo", alternates: { canonical: "/catalogo" } };

type CatalogPageProps = {
  searchParams: Promise<CatalogSearchParams>;
};

export default async function CatalogPage({ searchParams }: CatalogPageProps) {
  let catalog: { categories: CatalogCategory[]; filters: ReturnType<typeof parseCatalogFilters>; products: ReturnType<typeof sortCatalogProducts> } | null = null;
  try {
    const [storefrontProducts, storefrontCategories] = await Promise.all([getStorefrontProducts(), getStorefrontCategories()]);
    const categories = storefrontCategories.map(({ name, slug }) => ({ name, slug }));
    const filters = parseCatalogFilters(await searchParams, categories);
    catalog = { categories, filters, products: sortCatalogProducts(filterCatalogProducts(storefrontProducts, filters), filters.sort) };
  } catch {}

  if (!catalog) return <Container className="py-10 sm:py-14"><PageHeader eyebrow="Selección fresca" title="Catálogo" description="No pudimos cargar el catálogo. Inténtalo nuevamente en unos momentos." /></Container>;
  return <CatalogContent {...catalog} />;
}

function CatalogContent({ categories, filters, products }: { categories: CatalogCategory[]; filters: ReturnType<typeof parseCatalogFilters>; products: ReturnType<typeof sortCatalogProducts> }) {
  const hasActiveFilters = Boolean(filters.query || filters.category || filters.sort !== "recommended");
  const activeCategory = categories.find((category) => category.slug === filters.category);
  const resultsLabel = `${products.length} ${products.length === 1 ? "producto" : "productos"}${filters.query ? ` para “${filters.query}”` : ""}${activeCategory ? `${filters.query ? " en" : " en"} ${activeCategory.name}` : ""}`;

  return (
    <Container className="space-y-8 py-8 sm:space-y-10 sm:py-12 lg:py-14">
      <PageHeader eyebrow="Selección fresca" title="Catálogo" description="Explora productos seleccionados para complementar tu pedido." />

      <CatalogToolbar categories={categories} filters={filters} />

      <section aria-labelledby="catalog-results-title" className="space-y-5">
        <div className="flex flex-col gap-2 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 id="catalog-results-title" className="text-lg font-semibold tracking-tight text-foreground">{resultsLabel}</h2>
          {hasActiveFilters ? <ActionLink href="/catalogo" variant="quiet" className="self-start">Limpiar filtros</ActionLink> : null}
        </div>

        {products.length > 0 ? <ProductGrid products={products} variant="catalog" /> : <EmptyState title="No encontramos productos" description="Prueba con otra búsqueda o revisa todas las categorías." action={hasActiveFilters ? <ActionLink href="/catalogo">Limpiar filtros</ActionLink> : undefined} />}
      </section>
    </Container>
  );
}
