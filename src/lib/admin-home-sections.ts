import "server-only";

import { crearClienteSupabaseServidor } from "@/lib/supabase/server";
import type { ImageFallbackKind } from "@/types/media";

export const HOME_SECTION_DEFINITIONS = [
  { slug: "featured", title: "Frescos de Hidro Leufú", description: "Una selección prioritaria de productos hidropónicos." },
  { slug: "best-sellers", title: "Productos destacados", description: "Productos seleccionados para la vitrina principal." },
  { slug: "opportunities", title: "Más productos frescos", description: "Productos seleccionados manualmente para complementar la vitrina." },
  { slug: "new-arrivals", title: "Recién seleccionados", description: "Productos que se suman a la selección disponible." },
] as const;

export type HomeSectionSlug = (typeof HOME_SECTION_DEFINITIONS)[number]["slug"];

export type AdminHomeSectionProduct = {
  assignmentId: string;
  productId: string;
  slug: string;
  name: string;
  category: string;
  rutaImagen: string | null;
  imageFallback: ImageFallbackKind;
  activo: boolean;
  disponible: boolean;
  orden: number;
};

export type AdminHomeSection = {
  slug: HomeSectionSlug;
  title: string;
  description: string;
  products: readonly AdminHomeSectionProduct[];
};

export type AdminHomeSectionCandidate = {
  id: string;
  name: string;
  slug: string;
};

type ProductRow = {
  id: string;
  nombre: string;
  slug: string;
  ruta_imagen: string | null;
  activo: boolean;
  disponible: boolean;
  categorias: { nombre: string; slug: string } | null;
};

type AssignmentRow = {
  id: string;
  seccion_slug: HomeSectionSlug;
  orden: number;
  productos: ProductRow | null;
};

const imageFallbackByCategory: Record<string, ImageFallbackKind> = {
  hidroponicos: "herb",
  "verduras-hortalizas": "fresh-produce",
  frutas: "fruit",
  "hierbas-especias": "herb",
  "formatos-cajas": "package",
  otros: "package",
};

function mapAssignment(row: AssignmentRow): AdminHomeSectionProduct | null {
  const product = row.productos;
  if (!product) return null;

  return {
    assignmentId: row.id,
    productId: product.id,
    slug: product.slug,
    name: product.nombre,
    category: product.categorias?.nombre ?? "Sin categoría",
    rutaImagen: product.ruta_imagen,
    imageFallback: imageFallbackByCategory[product.categorias?.slug ?? ""] ?? "fresh-produce",
    activo: product.activo,
    disponible: product.disponible,
    orden: Number(row.orden),
  };
}

export async function obtenerSeccionesInicioAdmin(): Promise<readonly AdminHomeSection[]> {
  const supabase = await crearClienteSupabaseServidor();
  const { data, error } = await supabase
    .from("secciones_inicio_productos")
    .select("id,seccion_slug,orden,productos(id,nombre,slug,ruta_imagen,activo,disponible,categorias(nombre,slug))")
    .order("seccion_slug")
    .order("orden");

  if (error) throw new Error("No fue posible cargar las secciones de inicio.");

  const assignments = (data as unknown as AssignmentRow[] ?? []);
  return HOME_SECTION_DEFINITIONS.map((section) => ({
    ...section,
    products: assignments
      .filter((assignment) => assignment.seccion_slug === section.slug)
      .map(mapAssignment)
      .filter((product): product is AdminHomeSectionProduct => product !== null),
  }));
}

export async function obtenerProductosDisponiblesParaSeccionesInicioAdmin(): Promise<readonly AdminHomeSectionCandidate[]> {
  const supabase = await crearClienteSupabaseServidor();
  const { data, error } = await supabase
    .from("productos")
    .select("id,nombre,slug")
    .eq("activo", true)
    .eq("disponible", true)
    .order("orden")
    .order("nombre");

  if (error) throw new Error("No fue posible cargar los productos disponibles.");
  return (data ?? []).map((product) => ({ id: product.id, name: product.nombre, slug: product.slug }));
}
