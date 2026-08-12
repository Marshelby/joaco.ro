import { crearClienteSupabaseServidor } from "@/lib/supabase/server";

export type CategoriaAdmin = { id: string; nombre: string; slug: string; descripcion: string | null; activa: boolean; orden: number };
export type PresentacionAdmin = { id: string; nombre: string; cantidad: number; unidad: string; precioNeto: number; precioFinal: number; activa: true };
export type ProductoAdmin = { id: string; nombre: string; slug: string; descripcion: string | null; rutaImagen: string | null; categoriaId: string; categoria: string; activo: boolean; disponible: boolean; destacado: boolean; masVendido: boolean; nuevo: boolean; orden: number; presentacion: PresentacionAdmin };

type PresentacionAdminRow = {
  id: string;
  nombre: string;
  cantidad: number | string;
  unidad: string;
  precio_neto: number | string;
  precio_final: number | string;
  activa: boolean;
};

type ProductoAdminRow = {
  id: string;
  nombre: string;
  slug: string;
  descripcion: string | null;
  ruta_imagen: string | null;
  categoria_id: string;
  activo: boolean;
  disponible: boolean;
  destacado: boolean;
  mas_vendido: boolean;
  nuevo: boolean;
  orden: number;
  categorias: { nombre: string } | null;
  presentaciones_producto: PresentacionAdminRow[];
};

export class ProductoSinPresentacionPrincipalError extends Error {
  constructor() {
    super("El producto no tiene una presentación principal activa.");
  }
}

function mapProductoAdmin(fila: ProductoAdminRow): ProductoAdmin {
  const presentacion = fila.presentaciones_producto[0];
  if (!presentacion) throw new ProductoSinPresentacionPrincipalError();

  return {
    id: fila.id,
    nombre: fila.nombre,
    slug: fila.slug,
    descripcion: fila.descripcion,
    rutaImagen: fila.ruta_imagen,
    categoriaId: fila.categoria_id,
    categoria: fila.categorias?.nombre ?? "Sin categoría",
    activo: fila.activo,
    disponible: fila.disponible,
    destacado: fila.destacado,
    masVendido: fila.mas_vendido,
    nuevo: fila.nuevo,
    orden: fila.orden,
    presentacion: {
      id: presentacion.id,
      nombre: presentacion.nombre,
      cantidad: Number(presentacion.cantidad),
      unidad: presentacion.unidad,
      precioNeto: Number(presentacion.precio_neto),
      precioFinal: Number(presentacion.precio_final),
      activa: true,
    },
  };
}

function consultaProductosAdmin() {
  return "id,nombre,slug,descripcion,ruta_imagen,categoria_id,activo,disponible,destacado,mas_vendido,nuevo,orden,categorias(nombre),presentaciones_producto!inner(id,nombre,cantidad,unidad,precio_neto,precio_final,activa)";
}

export async function obtenerCategoriasAdmin() {
  const supabase = await crearClienteSupabaseServidor();
  const { data, error } = await supabase
    .from("categorias")
    .select("id,nombre,slug,descripcion,activa,orden")
    .eq("activa", true)
    .order("orden");
  if (error) throw error;
  return data as CategoriaAdmin[];
}

export async function obtenerProductosAdmin() {
  const supabase = await crearClienteSupabaseServidor();
  const { data, error } = await supabase
    .from("productos")
    .select(consultaProductosAdmin())
    .eq("presentaciones_producto.es_principal", true)
    .eq("presentaciones_producto.activa", true)
    .order("orden");
  if (error) throw error;
  return (data as unknown as ProductoAdminRow[] ?? []).map(mapProductoAdmin);
}

export async function obtenerProductoAdmin(id: string) {
  const supabase = await crearClienteSupabaseServidor();
  const { data, error } = await supabase
    .from("productos")
    .select(consultaProductosAdmin())
    .eq("id", id)
    .eq("presentaciones_producto.es_principal", true)
    .eq("presentaciones_producto.activa", true)
    .maybeSingle();
  if (error) throw error;
  if (data) return mapProductoAdmin(data as unknown as ProductoAdminRow);

  const { data: productoSinPresentacion, error: errorProducto } = await supabase
    .from("productos")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (errorProducto) throw errorProducto;
  if (productoSinPresentacion) throw new ProductoSinPresentacionPrincipalError();
  return null;
}
