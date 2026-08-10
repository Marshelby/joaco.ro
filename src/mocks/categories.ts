import type { CatalogCategoryMock } from "@/types/category";

export const CATEGORY_CATALOG_MOCK: readonly CatalogCategoryMock[] = [
  { id: "hidroponicos", name: "Hidropónicos", description: "Cultivos frescos seleccionados.", imageFallback: "herb", status: "active", subcategories: [{ id: "hidroponicos-cultivos", name: "Cultivos hidropónicos", status: "active" }] },
  { id: "verduras-hortalizas", name: "Verduras y hortalizas", description: "Variedad fresca para cada pedido.", imageFallback: "fresh-produce", status: "active", subcategories: [{ id: "verduras-frescas", name: "Verduras frescas", status: "active" }] },
  { id: "frutas", name: "Frutas", description: "Frutas frescas en distintos formatos.", imageFallback: "fruit", status: "active", subcategories: [{ id: "frutas-frescas", name: "Frutas frescas", status: "active" }] },
  { id: "hierbas-especias", name: "Hierbas y especias", description: "Hierbas y especias para complementar tus preparaciones.", imageFallback: "herb", status: "active", subcategories: [{ id: "hierbas-frescas", name: "Hierbas frescas", status: "active" }, { id: "especias", name: "Especias", status: "active" }] },
  { id: "formatos-cajas", name: "Formatos y cajas", description: "Formatos comerciales para distintos pedidos.", imageFallback: "package", status: "active", subcategories: [{ id: "formatos-comerciales", name: "Formatos comerciales", status: "active" }] },
  { id: "otros", name: "Otros", description: "Otros productos disponibles.", imageFallback: "package", status: "active", subcategories: [{ id: "otros-productos", name: "Otros productos", status: "active" }] },
];
