"use server";

import { revalidatePath } from "next/cache";

import { ROUTES } from "@/config/routes";
import { normalizeCatalogText } from "@/lib/catalog";
import { crearClienteSupabaseServidor } from "@/lib/supabase/server";

type CambioProducto = { id: string; origen: string | null; quitar?: true };
type CategoriaVersion = { id: string; version: string };
type DatosCategoria = { nombre: string; descripcion: string; orden: number; activa: boolean };

export type OperacionCategoria =
  | { tipo: "reordenar"; categorias: CategoriaVersion[]; id: string; direccion: -1 | 1 }
  | { tipo: "guardar"; categoria: CategoriaVersion | null; datos: DatosCategoria; productos: CambioProducto[] }
  | { tipo: "asignar"; categoria: CategoriaVersion; productos: CambioProducto[] }
  | { tipo: "eliminar"; categoria: CategoriaVersion; productos: CambioProducto[] };

export async function gestionarCategoria(operacion: OperacionCategoria): Promise<{ error?: string; recargar?: boolean }> {
  const supabase = await crearClienteSupabaseServidor();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Tu sesión expiró. Inicia sesión nuevamente." };
  const { data: esAdmin, error: errorPermisos } = await supabase.rpc("es_admin");
  if (errorPermisos || esAdmin !== true) return { error: "No se pudo verificar tu acceso administrativo." };

  let datos: (DatosCategoria & { slug: string }) | null = null;
  if (operacion.tipo === "guardar") {
    const nombre = operacion.datos.nombre.trim();
    const { orden } = operacion.datos;
    if (!nombre) return { error: "El nombre de la categoría es obligatorio." };
    if (!Number.isInteger(orden) || orden < -2147483648 || orden > 2147483647) {
      return { error: "El orden debe ser un número entero válido." };
    }

    const slug = normalizeCatalogText(nombre).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    datos = { ...operacion.datos, nombre, slug: slug || "categoria" };
  }

  const { error } = operacion.tipo === "reordenar"
    ? await supabase.rpc("reordenar_categorias_administrativas", {
      p_categorias: operacion.categorias,
      p_categoria_id: operacion.id,
      p_direccion: operacion.direccion,
    })
    : await supabase.rpc("gestionar_categoria_administrativa", {
      p_operacion: operacion.tipo,
      p_categoria_id: operacion.categoria?.id ?? null,
      p_version: operacion.categoria?.version ?? null,
      p_datos: datos,
      p_productos: operacion.productos,
    });
  if (error) {
    if (error.code === "PGRST202" || error.code === "42883") {
      return { error: operacion.tipo === "reordenar"
        ? "Para cambiar el orden, aplica el SQL manual de reordenamiento de categorías."
        : "El gestor requiere instalar el SQL manual de categorías antes de guardar cambios." };
    }
    if (error.code === "40001" || error.code === "40P01" || error.code === "23503") {
      return { error: "El catálogo cambió durante la edición. Vuelve a cargar los datos antes de confirmar.", recargar: true };
    }
    if (error.code === "42501") return { error: "No tienes permisos para gestionar categorías." };
    if (error.code === "23505") return { error: "Ya existe una categoría con el mismo identificador público. Elige otro nombre." };
    return { error: "No se pudo completar la operación. Revisa los datos y vuelve a intentarlo." };
  }

  for (const ruta of [
    ROUTES.adminPublicManager,
    ROUTES.adminCategories,
    ROUTES.adminHomeSections,
    ROUTES.adminNewOrder(),
    ROUTES.admin,
    ROUTES.checkout,
    ROUTES.home,
    ROUTES.catalog,
  ]) {
    revalidatePath(ruta);
  }
  revalidatePath("/catalogo/[slug]", "page");
  revalidatePath(ROUTES.adminProducts, "layout");
  return {};
}
