import "server-only";

import type { HomeSectionIcon } from "@/lib/home-section-icons";
import { crearClienteSupabaseServidor } from "@/lib/supabase/server";
import type { ImageFallbackKind } from "@/types/media";

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
  slug: string;
  title: string;
  description: string | null;
  icon: HomeSectionIcon;
  active: boolean;
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
    .from("secciones_inicio")
    .select("slug,nombre,descripcion,icono,activa,secciones_inicio_productos(id,orden,productos(id,nombre,slug,ruta_imagen,activo,disponible,categorias(nombre,slug)))")
    .order("orden")
    .order("orden", { referencedTable: "secciones_inicio_productos" });

  if (error) throw new Error("No fue posible cargar las secciones de inicio.", { cause: error });

  type SectionRow = {
    slug: string;
    nombre: string;
    descripcion: string | null;
    icono: HomeSectionIcon;
    activa: boolean;
    secciones_inicio_productos: AssignmentRow[];
  };

  return (data as unknown as SectionRow[]).map((section) => ({
    slug: section.slug,
    title: section.nombre,
    description: section.descripcion,
    icon: section.icono,
    active: section.activa,
    products: section.secciones_inicio_productos
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
