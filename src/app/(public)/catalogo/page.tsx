import type { Metadata } from "next";
import { CatalogToolbar } from "@/components/catalog/catalog-toolbar";
import { EmptyState } from "@/components/feedback/empty-state";
import { ProductGrid } from "@/components/home/product-grid";
import { Container } from "@/components/layout/container";
import { PageHeader } from "@/components/shared/page-header";
import { ActionLink } from "@/components/ui/action-link";
import { filterCatalogProducts, parseCatalogFilters, sortCatalogProducts, type CatalogSearchParams } from "@/lib/catalog";
import { HOME_CATEGORIES } from "@/mocks/home";
import { HOME_PRODUCTS } from "@/mocks/products";

export const metadata: Metadata = { title: "Catálogo" };

type CatalogPageProps = {
  searchParams: Promise<CatalogSearchParams>;
};

export default async function CatalogPage({ searchParams }: CatalogPageProps) {
  const categories = HOME_CATEGORIES.map((category) => category.name);
  const filters = parseCatalogFilters(await searchParams, categories);
  const products = sortCatalogProducts(
    filterCatalogProducts(HOME_PRODUCTS, filters),
    filters.sort,
  );
  const hasActiveFilters = Boolean(filters.query || filters.category || filters.sort !== "recommended");
  const resultsLabel = `${products.length} ${products.length === 1 ? "producto" : "productos"}${filters.query ? ` para “${filters.query}”` : ""}${filters.category ? `${filters.query ? " en" : " en"} ${filters.category}` : ""}`;

  return (
    <Container className="space-y-8 py-8 sm:space-y-10 sm:py-12 lg:py-14">
      <PageHeader eyebrow="Selección completa" title="Catálogo" description="Productos útiles, oportunidades y novedades para el hogar y el día a día." />

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
