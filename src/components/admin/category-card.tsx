import { CatalogImage } from "@/components/media/catalog-image";
import { ActionLink } from "@/components/ui/action-link";
import { ROUTES } from "@/config/routes";
import type { CatalogCategoryMock } from "@/types/category";
import { CategoryStatusBadge } from "./category-status-badge";
import { SubcategoryRow } from "./subcategory-row";

type CategoryCardProps = {
  category: CatalogCategoryMock;
};

export function CategoryCard({ category }: CategoryCardProps) {
  const subcategoryCount = category.subcategories.length;

  return (
    <article className="overflow-hidden rounded-xl border border-border bg-card">
      <header className="flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="relative size-12 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
            <CatalogImage className="object-cover" fallback={category.imageFallback} image={category.image} sizes="48px" />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold tracking-tight text-foreground">{category.name}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {subcategoryCount} {subcategoryCount === 1 ? "subcategoría" : "subcategorías"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <CategoryStatusBadge status={category.status} />
          <ActionLink href={ROUTES.adminCategory(category.id)} aria-label={`Editar categoría ${category.name}`} variant="quiet">
            Editar
          </ActionLink>
          <ActionLink href={ROUTES.adminNewSubcategory} aria-label={`Crear subcategoría en ${category.name}`} variant="secondary">
            Nueva subcategoría
          </ActionLink>
        </div>
      </header>

      <div className="border-t border-border bg-muted/35">
        <h3 className="sr-only">Subcategorías de {category.name}</h3>
        <ul className="divide-y divide-border">
          {category.subcategories.map((subcategory) => (
            <SubcategoryRow key={subcategory.id} subcategory={subcategory} />
          ))}
        </ul>
      </div>
    </article>
  );
}
