import { Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { MockProduct } from "@/types/product";

export function HomeSectionToolbar({ products, sectionTitle }: { products: readonly MockProduct[]; sectionTitle: string }) {
  return (
    <details className="group relative">
      <summary className={cn(buttonVariants(), "flex cursor-pointer list-none [&::-webkit-details-marker]:hidden")}>
        <Plus aria-hidden="true" />Agregar producto
      </summary>
      <div className="absolute right-0 z-10 mt-2 w-full min-w-72 rounded-xl border border-border bg-card p-4 shadow-lg sm:w-80">
        <label htmlFor={`home-section-selector-${sectionTitle}`} className="text-sm font-medium text-foreground">Seleccionar producto</label>
        <select id={`home-section-selector-${sectionTitle}`} defaultValue="" className="mt-2 h-11 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          <option value="">Elige un producto</option>
          {products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
        </select>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">La selección se guardará cuando se conecte el catálogo.</p>
      </div>
    </details>
  );
}
