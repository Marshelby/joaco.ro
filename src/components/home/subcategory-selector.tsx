import Link from "next/link";

import { getCatalogHref } from "@/lib/catalog";

export function SubcategorySelector({ category, categorySlug, items }: { category: string; categorySlug: string; items: readonly string[] }) {
  return <section className="rounded-xl border border-border bg-muted/45 p-4 sm:p-5" aria-labelledby="subcategory-title"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h3 id="subcategory-title" className="text-sm font-semibold text-foreground">Explora {category}</h3><div className="mt-3 flex flex-wrap gap-2">{items.map((item) => <span key={item} className="inline-flex min-h-9 items-center rounded-full border border-border bg-background px-3 text-sm font-medium text-foreground">{item}</span>)}</div></div><Link href={getCatalogHref({ category: categorySlug })} className="inline-flex min-h-11 shrink-0 items-center rounded-lg px-3 text-sm font-semibold text-primary outline-none transition-colors hover:bg-background focus-visible:ring-3 focus-visible:ring-ring/50">Ver productos</Link></div></section>;
}
