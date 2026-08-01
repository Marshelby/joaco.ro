import { ChevronDown, ChevronUp, X } from "lucide-react";
import { CatalogImage } from "@/components/media/catalog-image";
import { Button } from "@/components/ui/button";
import type { MockProduct } from "@/types/product";
import { SectionMoveButton } from "./section-move-button";

export function HomeSectionProductRow({ product, position }: { product: MockProduct; position: number }) {
  return (
    <li className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 p-4 sm:grid-cols-[2rem_4rem_minmax(0,1fr)_auto] sm:items-center sm:gap-4 sm:p-5">
      <p className="hidden text-sm font-semibold text-muted-foreground sm:block" aria-label={`Posición ${position}`}>{position}.</p>
      <div className="relative size-14 overflow-hidden rounded-lg border border-border bg-muted sm:size-16">
        <CatalogImage image={product.image} fallback={product.imageFallback} sizes="64px" fallbackIconClassName="size-7" />
      </div>
      <div className="min-w-0 self-center">
        <p className="truncate text-sm font-semibold text-foreground">{product.name}</p>
        <p className="mt-1 text-sm text-muted-foreground">{product.category}</p>
      </div>
      <div className="col-span-2 flex items-center justify-end gap-2 border-t border-border pt-3 sm:col-span-1 sm:border-0 sm:pt-0">
        <SectionMoveButton icon={ChevronUp} label={`Mover ${product.name} hacia arriba`} />
        <SectionMoveButton icon={ChevronDown} label={`Mover ${product.name} hacia abajo`} />
        <Button type="button" variant="ghost" className="h-11 px-3 text-destructive hover:text-destructive" aria-label={`Quitar ${product.name} de esta sección`}><X aria-hidden="true" />Quitar</Button>
      </div>
    </li>
  );
}
