import { ActionLink } from "@/components/ui/action-link";
import { ROUTES } from "@/config/routes";
import type { CatalogSubcategoryMock } from "@/types/category";
import { CategoryStatusBadge } from "./category-status-badge";

type SubcategoryRowProps = {
  subcategory: CatalogSubcategoryMock;
};

export function SubcategoryRow({ subcategory }: SubcategoryRowProps) {
  return (
    <li className="flex min-h-12 flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
      <p className="min-w-0 text-sm font-medium text-foreground">{subcategory.name}</p>
      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        <CategoryStatusBadge status={subcategory.status} />
        <ActionLink href={ROUTES.adminSubcategory(subcategory.id)} aria-label={`Editar subcategoría ${subcategory.name}`} variant="quiet">
          Editar
        </ActionLink>
      </div>
    </li>
  );
}
