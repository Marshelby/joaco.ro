"use client";

import { Search, SlidersHorizontal, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { CATALOG_SORT_OPTIONS, getCatalogHref, type CatalogCategory, type CatalogFilters, type CatalogSort } from "@/lib/catalog";
import { Button } from "@/components/ui/button";

type CatalogToolbarProps = {
  categories: readonly CatalogCategory[];
  filters: CatalogFilters;
};

export function CatalogToolbar({ categories, filters }: CatalogToolbarProps) {
  const router = useRouter();
  const hasActiveFilters = Boolean(filters.query || filters.category || filters.sort !== "recommended");
  const activeSortLabel = CATALOG_SORT_OPTIONS.find((option) => option.value === filters.sort)?.label;
  const activeCategory = categories.find((category) => category.slug === filters.category);

  function updateSort(sort: CatalogSort) {
    router.push(getCatalogHref({ ...filters, sort }));
  }

  return (
    <section className="space-y-5 rounded-xl border border-border bg-card p-4 sm:p-5" aria-label="Buscar y filtrar productos">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <form action="/catalogo" className="flex min-w-0 flex-1 gap-2" role="search">
          {filters.category ? <input type="hidden" name="categoria" value={filters.category} /> : null}
          {filters.sort !== "recommended" ? <input type="hidden" name="orden" value={filters.sort} /> : null}
          <label className="sr-only" htmlFor="catalog-search">Buscar productos</label>
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <input id="catalog-search" name="q" type="search" defaultValue={filters.query} placeholder="Buscar productos" className="h-11 w-full rounded-lg border border-input bg-background py-2 pl-10 pr-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring/50" />
          </div>
          <Button type="submit">Buscar</Button>
        </form>
        <label className="flex min-h-11 items-center gap-2 rounded-lg border border-input bg-background px-3 text-sm text-muted-foreground outline-none transition-shadow focus-within:ring-3 focus-within:ring-ring/50">
          <SlidersHorizontal className="size-4 shrink-0" aria-hidden="true" />
          <span className="sr-only">Ordenar productos</span>
          <select value={filters.sort} onChange={(event) => updateSort(event.target.value as CatalogSort)} className="min-h-11 min-w-0 bg-transparent font-medium text-foreground outline-none">
            {CATALOG_SORT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
      </div>

      <nav className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Filtrar por categoría">
        <Link href={getCatalogHref({ query: filters.query, sort: filters.sort })} aria-current={!filters.category ? "page" : undefined} className={`inline-flex min-h-10 shrink-0 items-center rounded-full border px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 ${!filters.category ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-foreground hover:bg-muted"}`}>Todas</Link>
        {categories.map((category) => {
          const active = filters.category === category.slug;
          return <Link key={category.slug} href={getCatalogHref({ query: filters.query, category: category.slug, sort: filters.sort })} aria-current={active ? "page" : undefined} className={`inline-flex min-h-10 shrink-0 items-center rounded-full border px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 ${active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-foreground hover:bg-muted"}`}>{category.name}</Link>;
        })}
      </nav>

      {hasActiveFilters ? <div className="flex flex-wrap items-center gap-2 text-sm" aria-label="Filtros activos">
        {filters.query ? <Link href={getCatalogHref({ category: filters.category, sort: filters.sort })} aria-label={`Quitar búsqueda ${filters.query}`} className="inline-flex min-h-9 items-center gap-1 rounded-full bg-muted px-3 font-medium text-foreground outline-none hover:bg-secondary focus-visible:ring-3 focus-visible:ring-ring/50">Búsqueda: “{filters.query}” <X className="size-3.5" aria-hidden="true" /></Link> : null}
        {filters.category && activeCategory ? <Link href={getCatalogHref({ query: filters.query, sort: filters.sort })} aria-label={`Quitar categoría ${activeCategory.name}`} className="inline-flex min-h-9 items-center gap-1 rounded-full bg-muted px-3 font-medium text-foreground outline-none hover:bg-secondary focus-visible:ring-3 focus-visible:ring-ring/50">{activeCategory.name} <X className="size-3.5" aria-hidden="true" /></Link> : null}
        {filters.sort !== "recommended" ? <Link href={getCatalogHref({ query: filters.query, category: filters.category })} aria-label={`Quitar orden ${activeSortLabel}`} className="inline-flex min-h-9 items-center gap-1 rounded-full bg-muted px-3 font-medium text-foreground outline-none hover:bg-secondary focus-visible:ring-3 focus-visible:ring-ring/50">Orden: {activeSortLabel} <X className="size-3.5" aria-hidden="true" /></Link> : null}
        <Link href="/catalogo" className="inline-flex min-h-9 items-center rounded-lg px-2 text-sm font-semibold text-primary outline-none hover:text-primary/75 focus-visible:ring-3 focus-visible:ring-ring/50">Limpiar filtros</Link>
      </div> : null}
    </section>
  );
}
