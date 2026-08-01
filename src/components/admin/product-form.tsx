"use client";

import { useState } from "react";
import { ActionLink } from "@/components/ui/action-link";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/config/routes";
import { getProductFormCategories, getProductFormSubcategories } from "@/lib/admin-product-form";
import type { ProductFormValues } from "@/types/admin-product-form";
import { ProductClassificationSection } from "./product-classification-section";
import { ProductGeneralSection } from "./product-general-section";
import { ProductImageField } from "./product-image-field";
import { ProductPriceSection } from "./product-price-section";
import { ProductStatusSection } from "./product-status-section";

export function ProductForm({ values }: { values: ProductFormValues }) {
  const [category, setCategory] = useState(values.category);
  const [subcategory, setSubcategory] = useState(values.subcategory);
  const categories = getProductFormCategories();
  const subcategories = getProductFormSubcategories(category);

  function handleCategoryChange(nextCategory: string) {
    setCategory(nextCategory);
    setSubcategory("");
  }

  return (
    <form className="space-y-5" aria-label="Formulario de producto">
      <ProductGeneralSection values={values} />
      <ProductClassificationSection
        categories={categories}
        category={category}
        onCategoryChange={handleCategoryChange}
        subcategories={subcategories}
        subcategory={subcategory}
        onSubcategoryChange={setSubcategory}
      />
      <ProductPriceSection values={values} />
      <ProductImageField values={values} />
      <ProductStatusSection values={values} />
      <footer className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-end">
        <ActionLink href={ROUTES.adminProducts} variant="secondary">Cancelar</ActionLink>
        <Button type="button">Guardar producto</Button>
      </footer>
    </form>
  );
}
