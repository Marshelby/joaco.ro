import type { MockProduct, ProductAvailability, ProductSaleUnit } from "@/types/product";

const saleUnitLabels: Record<ProductSaleUnit, string> = {
  kg: "por kg",
  unit: "por unidad",
  sack: "por saco",
  dozen: "por docena",
  "100g": "por 100 g",
};

export function getProductSaleUnitLabel(unit: ProductSaleUnit) {
  if (unit.startsWith("presentation:")) return unit.slice("presentation:".length);
  return saleUnitLabels[unit];
}

const availabilityContent: Record<
  ProductAvailability,
  { label: string; description: string }
> = {
  available_subject_to_confirmation: {
    label: "Disponible para solicitar",
    description: "La disponibilidad final se confirma al revisar tu pedido.",
  },
  limited_availability: {
    label: "Disponibilidad limitada",
    description: "La disponibilidad final se confirma al revisar tu pedido.",
  },
  out_of_stock: {
    label: "No disponible",
    description: "Este producto no está disponible para solicitar por ahora.",
  },
};

export function getProductBySlug(
  products: readonly MockProduct[],
  slug: string,
) {
  return products.find((product) => product.slug === slug);
}

export function getProductAvailabilityContent(availability: ProductAvailability) {
  return availabilityContent[availability];
}

export function getRelatedProducts(
  products: readonly MockProduct[],
  product: MockProduct,
  limit = 4,
) {
  const candidates = [
    ...products.filter(
      (item) =>
        item.id !== product.id &&
        item.subcategory === product.subcategory &&
        item.category === product.category,
    ),
    ...products.filter(
      (item) => item.id !== product.id && item.category === product.category,
    ),
    ...products.filter(
      (item) =>
        item.id !== product.id &&
        (item.featured || item.opportunity || item.newArrival),
    ),
  ];

  return candidates.filter(
    (item, index) => candidates.findIndex((candidate) => candidate.id === item.id) === index,
  ).slice(0, limit);
}
