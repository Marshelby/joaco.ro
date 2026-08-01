import type { CatalogVisibilityStatus } from "@/types/category";

const STATUS_LABEL: Record<CatalogVisibilityStatus, string> = {
  active: "Activa",
  hidden: "Oculta",
};

const STATUS_CLASS: Record<CatalogVisibilityStatus, string> = {
  active: "bg-primary/10 text-primary",
  hidden: "bg-muted text-muted-foreground",
};

type CategoryStatusBadgeProps = {
  status: CatalogVisibilityStatus;
};

export function CategoryStatusBadge({ status }: CategoryStatusBadgeProps) {
  return (
    <span className={`inline-flex min-h-7 items-center rounded-full px-2.5 text-xs font-semibold ${STATUS_CLASS[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}
