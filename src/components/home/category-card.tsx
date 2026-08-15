import { CatalogImage } from "@/components/media/catalog-image";
import { cn } from "@/lib/utils";
import type { HomeCategory } from "@/mocks/home";

const categoryImageBySlug: Record<string, string> = {
  hidroponicos: "/categorias/hidroponicos.webp",
  "verduras-hortalizas": "/categorias/verduras.webp",
  frutas: "/categorias/frutas.webp",
  "hierbas-especias": "/categorias/hierbas.webp",
  "formatos-cajas": "/categorias/sacosycajas.webp",
  otros: "/categorias/otros.webp",
};

export function CategoryCard({ category, active, onSelect }: { category: HomeCategory; active: boolean; onSelect: () => void }) {
  const categoryImage = categoryImageBySlug[category.slug];

  return <button type="button" onClick={onSelect} aria-label={category.name} aria-pressed={active} className={cn("group w-full overflow-hidden rounded-xl border bg-card text-left outline-none transition duration-200 hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transform-none", active ? "border-primary/60 ring-1 ring-primary/20" : "border-border")}>
    <div className="relative aspect-[16/9] overflow-hidden bg-white"><CatalogImage image={categoryImage ? { src: categoryImage, alt: category.name, fit: "contain" } : category.image} fallback={category.imageFallback} sizes="(min-width: 1280px) 20vw, (min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw" className="transition duration-300 group-hover:scale-[1.03] motion-reduce:transition-none" /></div>
    <div className="p-4"><p className="text-sm leading-5 text-muted-foreground">{category.description}</p></div>
  </button>;
}
