"use client";

import { SlidersHorizontal, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { CATALOG_SORT_OPTIONS, getCatalogHref, type CatalogCategory, type CatalogFilters, type CatalogSort } from "@/lib/catalog";
import { CatalogSearchForm } from "@/components/catalog/catalog-search-form";
import { PublicLink, usePublicNavigationFeedback } from "@/components/navigation/public-navigation-feedback";

type CatalogToolbarProps = {
  categories: readonly CatalogCategory[];
  filters: CatalogFilters;
};

export function CatalogToolbar({ categories, filters }: CatalogToolbarProps) {
  const router = useRouter();
  const feedback = usePublicNavigationFeedback();
  const [ordenando, iniciarOrdenamiento] = useTransition();
  const hasActiveFilters = Boolean(filters.query || filters.category || filters.sort !== "recommended");
  const activeSortLabel = CATALOG_SORT_OPTIONS.find((option) => option.value === filters.sort)?.label;
  const activeCategory = categories.find((category) => category.slug === filters.category);

  function updateSort(sort: CatalogSort) {
    if (sort === filters.sort) return;
    const href = getCatalogHref({ ...filters, sort });
    feedback?.beginNavigation(href);
    iniciarOrdenamiento(() => router.push(href));
  }

  return (
    <section className="space-y-5 rounded-xl border border-border bg-card p-4 sm:p-5" aria-label="Buscar y filtrar productos">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <CatalogSearchForm mode="live" initialQuery={filters.query} category={filters.category} sort={filters.sort} variant="toolbar" placeholder="Buscar productos" />
        <label aria-busy={ordenando || undefined} className="flex min-h-11 items-center gap-2 rounded-lg border border-input bg-background px-3 text-sm text-muted-foreground outline-none transition-[box-shadow,opacity] duration-[var(--motion-fast)] ease-[var(--motion-ease-standard)] focus-within:ring-3 focus-within:ring-ring/50">
          <SlidersHorizontal className="size-4 shrink-0" aria-hidden="true" />
          <span className="sr-only">Ordenar productos</span>
          <select value={filters.sort} disabled={ordenando} onChange={(event) => updateSort(event.target.value as CatalogSort)} className="min-h-11 min-w-0 bg-transparent font-medium text-foreground outline-none disabled:cursor-wait disabled:opacity-60">
            {CATALOG_SORT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
      </div>

      <nav className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Filtrar por categoría">
        <PublicLink href={getCatalogHref({ query: filters.query, sort: filters.sort })} aria-current={!filters.category ? "page" : undefined} className={`inline-flex min-h-10 shrink-0 items-center rounded-full border px-3 text-sm font-medium outline-none transition-[background-color,border-color,color,transform] duration-[var(--motion-fast)] ease-[var(--motion-ease-standard)] active:translate-y-px focus-visible:ring-3 focus-visible:ring-ring/50 ${!filters.category ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-foreground hover:bg-muted"}`}>Todas</PublicLink>
        {categories.map((category) => {
          const active = filters.category === category.slug;
          return <PublicLink key={category.slug} href={getCatalogHref({ query: filters.query, category: category.slug, sort: filters.sort })} aria-current={active ? "page" : undefined} className={`inline-flex min-h-10 shrink-0 items-center rounded-full border px-3 text-sm font-medium outline-none transition-[background-color,border-color,color,transform] duration-[var(--motion-fast)] ease-[var(--motion-ease-standard)] active:translate-y-px focus-visible:ring-3 focus-visible:ring-ring/50 ${active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-foreground hover:bg-muted"}`}>{category.name}</PublicLink>;
        })}
      </nav>

      {hasActiveFilters ? <div className="flex flex-wrap items-center gap-2 text-sm" aria-label="Filtros activos">
        {filters.query ? <PublicLink href={getCatalogHref({ category: filters.category, sort: filters.sort })} aria-label={`Quitar búsqueda ${filters.query}`} className="inline-flex min-h-9 items-center gap-1 rounded-full bg-muted px-3 font-medium text-foreground outline-none transition-[background-color,transform] duration-[var(--motion-fast)] ease-[var(--motion-ease-standard)] hover:bg-secondary active:translate-y-px focus-visible:ring-3 focus-visible:ring-ring/50">Búsqueda: “{filters.query}” <X className="size-3.5" aria-hidden="true" /></PublicLink> : null}
        {filters.category && activeCategory ? <PublicLink href={getCatalogHref({ query: filters.query, sort: filters.sort })} aria-label={`Quitar categoría ${activeCategory.name}`} className="inline-flex min-h-9 items-center gap-1 rounded-full bg-muted px-3 font-medium text-foreground outline-none transition-[background-color,transform] duration-[var(--motion-fast)] ease-[var(--motion-ease-standard)] hover:bg-secondary active:translate-y-px focus-visible:ring-3 focus-visible:ring-ring/50">{activeCategory.name} <X className="size-3.5" aria-hidden="true" /></PublicLink> : null}
        {filters.sort !== "recommended" ? <PublicLink href={getCatalogHref({ query: filters.query, category: filters.category })} aria-label={`Quitar orden ${activeSortLabel}`} className="inline-flex min-h-9 items-center gap-1 rounded-full bg-muted px-3 font-medium text-foreground outline-none transition-[background-color,transform] duration-[var(--motion-fast)] ease-[var(--motion-ease-standard)] hover:bg-secondary active:translate-y-px focus-visible:ring-3 focus-visible:ring-ring/50">Orden: {activeSortLabel} <X className="size-3.5" aria-hidden="true" /></PublicLink> : null}
        <PublicLink href="/catalogo" className="inline-flex min-h-9 items-center rounded-lg px-2 text-sm font-semibold text-primary outline-none transition-[color,transform] duration-[var(--motion-fast)] ease-[var(--motion-ease-standard)] hover:text-primary/75 active:translate-y-px focus-visible:ring-3 focus-visible:ring-ring/50">Limpiar filtros</PublicLink>
      </div> : null}
    </section>
  );
}
