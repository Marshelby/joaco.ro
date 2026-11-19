import { Buffer } from "node:buffer";

import { crearClienteSupabaseServidor } from "@/lib/supabase/server";

export type CategoriaAdmin = { id: string; nombre: string; slug: string; descripcion: string | null; activa: boolean; orden: number };
export type PresentacionAdmin = { id: string; nombre: string; cantidad: number; unidad: string; precioNeto: number; precioFinal: number; activa: true };
export type ProductoAdmin = { id: string; nombre: string; slug: string; descripcion: string | null; rutaImagen: string | null; categoriaId: string | null; categoria: string; activo: boolean; disponible: boolean; destacado: boolean; masVendido: boolean; nuevo: boolean; orden: number; presentacion: PresentacionAdmin };

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
  categoria_id: string | null;
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

export type CategoriaGestor = CategoriaAdmin & { fecha_actualizacion: string };
export type ProductoClasificable = { id: string; nombre: string; categoria_id: string | null };

async function leerCatalogoCompleto<Fila extends { id: string }>(
  obtenerPagina: (ultimoId: string | undefined) => PromiseLike<{ data: Fila[] | null; error: unknown }>,
) {
  const filas: Fila[] = [];
  let ultimoId: string | undefined;
  while (true) {
    const { data, error } = await obtenerPagina(ultimoId);
    if (error) throw error;
    if (!data?.length) return filas;
    filas.push(...data);
    ultimoId = data[data.length - 1].id;
  }
}

export async function obtenerClasificacionAdmin() {
  const supabase = await crearClienteSupabaseServidor();
  const { data: esAdmin, error } = await supabase.rpc("es_admin");
  if (error || esAdmin !== true) throw new Error("Acceso administrativo requerido.");

  const [categorias, productos] = await Promise.all([
    leerCatalogoCompleto<CategoriaGestor>((ultimoId) => {
      const consulta = supabase.from("categorias")
        .select("id,nombre,slug,descripcion,activa,orden,fecha_actualizacion").order("id").limit(500);
      return ultimoId ? consulta.gt("id", ultimoId) : consulta;
    }),
    leerCatalogoCompleto<ProductoClasificable>((ultimoId) => {
      const consulta = supabase.from("productos").select("id,nombre,categoria_id").order("id").limit(500);
      return ultimoId ? consulta.gt("id", ultimoId) : consulta;
    }),
  ]);
  // Mismo desempate por bytes UTF-8 e ID que en la RPC de reordenamiento.
  categorias.sort((a, b) => a.orden - b.orden
    || Buffer.compare(Buffer.from(a.nombre, "utf8"), Buffer.from(b.nombre, "utf8"))
    || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  productos.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  return { categorias, productos };
}
