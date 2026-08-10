import { CATEGORY_CATALOG_MOCK } from "@/mocks/categories";
import type { ProductFormValues } from "@/types/admin-product-form";
import type { MockProduct } from "@/types/product";

export const EMPTY_PRODUCT_FORM_VALUES: ProductFormValues = {
  name: "",
  description: "",
  category: "",
  subcategory: "",
  netPrice: undefined,
  unitPrice: undefined,
  saleUnit: "unit",
  imageFallback: "fresh-produce",
  status: "active",
};

export function getProductFormValues(product?: MockProduct): ProductFormValues {
  if (!product) {
    return EMPTY_PRODUCT_FORM_VALUES;
  }

  return {
    name: product.name,
    description: product.description,
    category: product.category,
    subcategory: product.subcategory ?? "",
    netPrice: product.netPrice,
    unitPrice: product.unitPrice,
    saleUnit: product.saleUnit,
    image: product.image,
    imageFallback: product.imageFallback,
    status: product.adminStatus,
  };
}

export function getProductFormCategories() {
  return [...CATEGORY_CATALOG_MOCK].sort((left, right) => left.name.localeCompare(right.name, "es-CL"));
}

export function getProductFormSubcategories(categoryName: string) {
  const category = CATEGORY_CATALOG_MOCK.find((item) => item.name === categoryName);

  return category ? [...category.subcategories].sort((left, right) => left.name.localeCompare(right.name, "es-CL")) : [];
}
