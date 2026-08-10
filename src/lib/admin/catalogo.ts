import { crearClienteSupabaseServidor } from "@/lib/supabase/server";

export type CategoriaAdmin = { id: string; nombre: string; slug: string; descripcion: string | null; activa: boolean; orden: number };
export type ProductoAdmin = { id: string; nombre: string; slug: string; descripcion: string | null; rutaImagen: string | null; categoriaId: string; categoria: string; activo: boolean; disponible: boolean; destacado: boolean; masVendido: boolean; nuevo: boolean; orden: number; presentacion: { nombre: string; cantidad: number; unidad: string; precioNeto: number; precioFinal: number; activa: boolean } };

export async function obtenerCategoriasAdmin() {
  const supabase = await crearClienteSupabaseServidor();
  const { data, error } = await supabase.from("categorias").select("id,nombre,slug,descripcion,activa,orden").order("orden");
  if (error) throw error;
  return data as CategoriaAdmin[];
}

export async function obtenerProductosAdmin() {
  const supabase = await crearClienteSupabaseServidor();
  const { data, error } = await supabase.from("productos").select("id,nombre,slug,descripcion,ruta_imagen,categoria_id,activo,disponible,destacado,mas_vendido,nuevo,orden,categorias(nombre),presentaciones_producto(nombre,cantidad,unidad,precio_neto,precio_final,activa,es_principal)").order("orden");
  if (error) throw error;
  return (data ?? []).map((fila: any): ProductoAdmin => {
    const presentacion = fila.presentaciones_producto.find((item: any) => item.es_principal) ?? fila.presentaciones_producto[0];
    return { id: fila.id, nombre: fila.nombre, slug: fila.slug, descripcion: fila.descripcion, rutaImagen: fila.ruta_imagen, categoriaId: fila.categoria_id, categoria: fila.categorias?.nombre ?? "Sin categoría", activo: fila.activo, disponible: fila.disponible, destacado: fila.destacado, masVendido: fila.mas_vendido, nuevo: fila.nuevo, orden: fila.orden, presentacion: { nombre: presentacion?.nombre ?? "", cantidad: Number(presentacion?.cantidad ?? 1), unidad: presentacion?.unidad ?? "UND", precioNeto: presentacion?.precio_neto ?? 0, precioFinal: presentacion?.precio_final ?? 0, activa: presentacion?.activa ?? true } };
  });
}

export async function obtenerProductoAdmin(id: string) {
  return (await obtenerProductosAdmin()).find((producto) => producto.id === id) ?? null;
}
