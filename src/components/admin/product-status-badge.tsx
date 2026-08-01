import type { ProductVisibilityStatus } from "@/types/product";

const statusPresentation: Record<ProductVisibilityStatus, { label: string; className: string }> = {
  active: { label: "Activo", className: "bg-primary/10 text-primary" },
  hidden: { label: "Oculto", className: "bg-muted text-muted-foreground" },
};

export function ProductStatusBadge({ status }: { status: ProductVisibilityStatus }) {
  const presentation = statusPresentation[status];

  return <span className={`inline-flex min-h-7 items-center rounded-full px-2.5 text-xs font-semibold ${presentation.className}`}>{presentation.label}</span>;
}
