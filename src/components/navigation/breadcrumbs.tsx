import Link from "next/link";
import { ChevronRight } from "lucide-react";

type BreadcrumbItem = { label: string; href?: string };

export function Breadcrumbs({ items }: { items: readonly BreadcrumbItem[] }) {
  return (
    <nav aria-label="Migas de pan" className="min-w-0">
      <ol className="flex min-w-0 items-center gap-1 overflow-x-auto text-xs text-muted-foreground">
        {items.map((item, index) => (
          <li key={`${item.label}-${index}`} className="flex shrink-0 items-center gap-1">
            {index > 0 ? <ChevronRight className="size-3" aria-hidden="true" /> : null}
            {item.href ? <Link href={item.href} className="rounded-sm outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">{item.label}</Link> : <span aria-current="page">{item.label}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}
