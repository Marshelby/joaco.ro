"use client";

import { useRef, useState } from "react";

import { CategoryCard } from "@/components/home/category-card";
import { ProductGrid } from "@/components/home/product-grid";
import { SubcategorySelector } from "@/components/home/subcategory-selector";
import type { HomeCategory } from "@/mocks/home";
import type { MockProduct } from "@/types/product";

export function CategorySelector({ categories, products }: { categories: readonly HomeCategory[]; products: readonly MockProduct[] }) {
  const [selectedCategorySlug, setSelectedCategorySlug] = useState(categories[0]?.slug);
  const productsSectionRef = useRef<HTMLElement>(null);
  const active = categories.find((category) => category.slug === selectedCategorySlug) ?? categories[0];
  if (!active) return null;
  const selectedProducts = products.filter((product) => product.categorySlug === active.slug);

  const selectCategory = (slug: string) => {
    setSelectedCategorySlug(slug);
    requestAnimationFrame(() => {
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      productsSectionRef.current?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
    });
  };

  return <div className="space-y-6"><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">{categories.map((category) => <CategoryCard key={category.slug} category={category} active={category.slug === active.slug} onSelect={() => selectCategory(category.slug)} />)}</div><SubcategorySelector category={active.name} categorySlug={active.slug} items={active.subcategories} /><section ref={productsSectionRef} aria-labelledby="category-products-title" className="scroll-mt-6 space-y-5"><h2 id="category-products-title" className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">Productos de {active.name}</h2>{selectedProducts.length > 0 ? <ProductGrid products={selectedProducts} variant="catalog" /> : <div className="rounded-xl border border-dashed border-border bg-card p-6 text-center text-sm leading-6 text-muted-foreground sm:p-8" role="status">No hay productos disponibles en esta categoría por ahora.</div>}</section></div>;
}
