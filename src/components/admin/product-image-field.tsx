import { ImagePlus } from "lucide-react";
import { CatalogImage } from "@/components/media/catalog-image";
import { Button } from "@/components/ui/button";
import type { ProductFormValues } from "@/types/admin-product-form";

export function ProductImageField({ values }: { values: ProductFormValues }) {
  return (
    <section aria-labelledby="product-image-title" className="rounded-xl border border-border bg-card p-5 sm:p-6">
      <div className="space-y-1">
        <h2 id="product-image-title" className="text-lg font-semibold tracking-tight text-foreground">Imagen</h2>
        <p className="text-sm leading-6 text-muted-foreground">Una imagen principal para reconocer el producto.</p>
      </div>
      <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative size-24 shrink-0 overflow-hidden rounded-xl border border-border bg-muted">
          <CatalogImage image={values.image} fallback={values.imageFallback} sizes="96px" fallbackIconClassName="size-10" />
        </div>
        <div className="space-y-3">
          <p className="text-sm font-medium text-foreground">Imagen actual</p>
          <Button type="button" variant="outline"><ImagePlus aria-hidden="true" />Cambiar imagen</Button>
          <p className="text-xs leading-5 text-muted-foreground">La selección de imagen se conectará cuando exista almacenamiento.</p>
        </div>
      </div>
    </section>
  );
}
