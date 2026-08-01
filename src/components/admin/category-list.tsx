"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { EmptyState } from "@/components/feedback/empty-state";
import { searchAdminCategories } from "@/lib/admin-categories";
import type { CatalogCategoryMock } from "@/types/category";
import { CategoryCard } from "./category-card";

type CategoryListProps = {
  categories: readonly CatalogCategoryMock[];
};

export function CategoryList({ categories }: CategoryListProps) {
  const [query, setQuery] = useState("");
  const visibleCategories = useMemo(() => searchAdminCategories(categories, query), [categories, query]);

  return (
    <section aria-labelledby="category-list-title" className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="category-list-title" className="text-2xl font-semibold tracking-tight text-foreground">
            Categorías y subcategorías
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{categories.length} categorías organizadas para la tienda.</p>
        </div>
        <label className="relative block w-full sm:max-w-sm">
          <span className="sr-only">Buscar categoría o subcategoría</span>
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            className="h-11 w-full rounded-lg border border-input bg-background py-2 pl-10 pr-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar categoría o subcategoría"
            type="search"
            value={query}
          />
        </label>
      </div>

      {visibleCategories.length ? (
        <div className="space-y-4">
          {visibleCategories.map((category) => (
            <CategoryCard key={category.id} category={category} />
          ))}
        </div>
      ) : (
        <EmptyState description="Prueba con el nombre de otra categoría o subcategoría." title="No encontramos coincidencias" />
      )}
    </section>
  );
}
