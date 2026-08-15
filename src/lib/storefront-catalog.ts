import "server-only";

import type { HomeCategory } from "@/mocks/home";
import type { ImageFallbackKind } from "@/types/media";
import type { MockProduct, ProductSaleUnit } from "@/types/product";
import { crearClienteSupabaseServidor } from "@/lib/supabase/server";

type CatalogRow = {
  id: string;
  nombre: string;
  slug: string;
  descripcion: string | null;
  ruta_imagen: string | null;
  activo: boolean;
  disponible: boolean;
  destacado: boolean;
  mas_vendido: boolean;
  nuevo: boolean;
  orden: number;
  categorias: { nombre: string; slug: string } | null;
  presentaciones_producto: Array<{
    id: string;
    nombre: string;
    cantidad: number | string;
    unidad: string;
    precio_neto: number | string;
    precio_final: number | string;
    es_principal: boolean;
    activa: boolean;
    orden: number;
  }>;
};

const imageFallbackByCategory: Record<string, ImageFallbackKind> = {
  hidroponicos: "herb",
  "verduras-hortalizas": "fresh-produce",
  frutas: "fruit",
  "hierbas-especias": "herb",
  "formatos-cajas": "package",
  otros: "package",
};

function getImageAlt(name: string) {
  return `Fotografía de ${name}`;
}

function getSaleUnit(presentation: CatalogRow["presentaciones_producto"][number]): ProductSaleUnit {
  const unit = presentation.unidad.toUpperCase();
  const quantity = Number(presentation.cantidad);
  const name = presentation.nombre.trim().toLocaleLowerCase("es-CL");
  const displayUnit = unit === "UND" ? "und" : unit.toLocaleLowerCase("es-CL");

  if (name.includes("docena")) return "presentation:docena";
  for (const format of ["paquete", "malla", "saco", "caja"] as const) {
    if (!name.includes(format)) continue;
    if (quantity === 1 && unit === "UND") return `presentation:${format}`;
    return `presentation:${format} ${quantity} ${displayUnit}`;
  }
  if (unit === "KG") return "kg";
  if (unit === "UND" && quantity === 1) return "unit";
  if (unit === "GR" && quantity === 100) return "presentation:100 gr";
  if (quantity !== 1) return `presentation:${quantity} ${displayUnit}`;
  return "unit";
}

export function mapStorefrontProduct(row: CatalogRow): MockProduct | null {
  const presentation = row.presentaciones_producto[0];
  const category = row.categorias;
  if (!presentation || !category) return null;

  return {
    id: row.id,
    name: row.nombre,
    slug: row.slug,
    description: row.descripcion?.trim() || "Producto fresco seleccionado para tu negocio.",
    image: row.ruta_imagen ? { src: row.ruta_imagen, alt: getImageAlt(row.nombre), fit: "contain" } : undefined,
    imageFallback: imageFallbackByCategory[category.slug] ?? "fresh-produce",
    category: category.nombre,
    categorySlug: category.slug,
    netPrice: Number(presentation.precio_neto),
    unitPrice: Number(presentation.precio_final),
    saleUnit: getSaleUnit(presentation),
    presentationId: presentation.id,
    presentationName: presentation.nombre,
    presentationQuantity: Number(presentation.cantidad),
    presentationUnit: presentation.unidad,
    badge: row.nuevo ? "Nuevo" : row.destacado ? "Destacado" : undefined,
    availability: row.disponible ? "available_subject_to_confirmation" : "out_of_stock",
    adminStatus: row.activo ? "active" : "hidden",
    featured: row.destacado,
    bestSeller: row.mas_vendido,
    opportunity: false,
    newArrival: row.nuevo,
  };
}

async function queryProducts(options?: { slug?: string }) {
  const supabase = await crearClienteSupabaseServidor();
  let query = supabase
    .from("productos")
    .select("id,nombre,slug,descripcion,ruta_imagen,activo,disponible,destacado,mas_vendido,nuevo,orden,categorias!inner(nombre,slug,descripcion,activa,orden),presentaciones_producto!inner(id,nombre,cantidad,unidad,precio_neto,precio_final,es_principal,activa,orden)")
    .eq("activo", true)
    .eq("disponible", true)
    .eq("categorias.activa", true)
    .eq("presentaciones_producto.activa", true)
    .eq("presentaciones_producto.es_principal", true)
    .order("orden");
  if (options?.slug) query = query.eq("slug", options.slug);
  const { data, error } = await query;
  if (error) throw new Error("No fue posible cargar el catálogo.");
  return (data as unknown as CatalogRow[] ?? []).map(mapStorefrontProduct).filter((product): product is MockProduct => product !== null);
}

export async function getStorefrontProducts() {
  return queryProducts();
}

export async function getStorefrontProduct(slug: string) {
  return (await queryProducts({ slug }))[0] ?? null;
}

export async function getStorefrontProductsByPresentationIds(presentationIds: readonly string[]) {
  const ids = [...new Set(presentationIds)];
  if (ids.length === 0) return [];

  const supabase = await crearClienteSupabaseServidor();
  const { data, error } = await supabase
    .from("productos")
    .select("id,nombre,slug,descripcion,ruta_imagen,activo,disponible,destacado,mas_vendido,nuevo,orden,categorias!inner(nombre,slug,descripcion,activa,orden),presentaciones_producto!inner(id,nombre,cantidad,unidad,precio_neto,precio_final,es_principal,activa,orden)")
    .in("presentaciones_producto.id", ids)
    .eq("activo", true)
    .eq("disponible", true)
    .eq("categorias.activa", true)
    .eq("presentaciones_producto.activa", true)
    .eq("presentaciones_producto.es_principal", true);

  if (error) throw new Error("No fue posible resolver los productos actuales.");
  return (data as unknown as CatalogRow[] ?? []).map(mapStorefrontProduct).filter((product): product is MockProduct => product !== null);
}

export async function getStorefrontCategories(): Promise<HomeCategory[]> {
  const supabase = await crearClienteSupabaseServidor();
  const { data, error } = await supabase
    .from("categorias")
    .select("nombre,descripcion,slug")
    .eq("activa", true)
    .order("orden");
  if (error) throw new Error("No fue posible cargar las categorías.");
  return (data ?? []).map((category) => ({
    slug: category.slug,
    name: category.nombre,
    description: category.descripcion ?? "Productos frescos seleccionados.",
    imageFallback: imageFallbackByCategory[category.slug] ?? "fresh-produce",
    subcategories: [],
  }));
}

export function getStorefrontRelatedProducts(products: readonly MockProduct[], product: MockProduct, limit = 4) {
  const rankByStorefrontPriority = (items: readonly MockProduct[]) => [...items].sort((left, right) => {
    const leftPriority = Number(left.featured || left.bestSeller);
    const rightPriority = Number(right.featured || right.bestSeller);
    return rightPriority - leftPriority;
  });
  const candidates = products.filter((item) => item.id !== product.id);
  const sameCategory = product.categorySlug
    ? candidates.filter((item) => item.categorySlug === product.categorySlug)
    : [];
  const selected = rankByStorefrontPriority(sameCategory).slice(0, limit);
  const selectedIds = new Set(selected.map((item) => item.id));
  const fallback = rankByStorefrontPriority(candidates).filter((item) => !selectedIds.has(item.id));

  return [...selected, ...fallback].slice(0, limit);
}
