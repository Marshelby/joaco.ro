"use client";

import { useState } from "react";

import { CatalogImage } from "@/components/media/catalog-image";
import { cn } from "@/lib/utils";
import type { MockProduct } from "@/types/product";

function getProductImages(product: MockProduct) {
  const images = [product.image, ...(product.images ?? [])].filter(
    (image): image is NonNullable<typeof image> => image !== undefined,
  );

  return images.filter(
    (image, index, collection) =>
      collection.findIndex((candidate) => candidate.src === image.src) === index,
  );
}

export function ProductMedia({ product }: { product: MockProduct }) {
  const images = getProductImages(product);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selectedImage = images[selectedIndex];

  return (
    <div>
      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-muted/60">
        <CatalogImage
          image={selectedImage}
          fallback={product.imageFallback}
          priority
          sizes="(min-width: 1024px) 52vw, 100vw"
          fallbackIconClassName="size-20 sm:size-24"
        />
        {product.badge ? (
          <span className="absolute left-4 top-4 rounded-full bg-background/95 px-3 py-1.5 text-xs font-semibold text-foreground shadow-sm">
            {product.badge}
          </span>
        ) : null}
      </div>

      {images.length > 1 ? (
        <div className="mt-3 flex gap-2" aria-label="Imágenes del producto">
          {images.map((image, index) => (
            <button
              key={image.src}
              type="button"
              aria-label={`Ver imagen ${index + 1} de ${images.length}: ${image.alt}`}
              aria-pressed={selectedIndex === index}
              onClick={() => setSelectedIndex(index)}
              className={cn(
                "relative size-14 overflow-hidden rounded-lg border outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                selectedIndex === index ? "border-primary ring-1 ring-primary/30" : "border-border hover:border-primary/35",
              )}
            >
              <CatalogImage image={image} fallback={product.imageFallback} sizes="56px" fallbackIconClassName="size-5" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
