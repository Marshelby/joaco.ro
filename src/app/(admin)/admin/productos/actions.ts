"use server";

import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ROUTES } from "@/config/routes";
import { BUCKET_IMAGEN_PRODUCTO, TIPO_IMAGEN_PRODUCTO, validarArchivoImagenProducto } from "@/lib/product-image";
import { crearClienteSupabaseServidor } from "@/lib/supabase/server";

export type EstadoGuardadoProducto = { error?: string; errorImagen?: string };

const texto = (datos: FormData, campo: string) => String(datos.get(campo) ?? "").trim();
const entero = (datos: FormData, campo: string) => Number(texto(datos, campo));
type ClienteSupabase = Awaited<ReturnType<typeof crearClienteSupabaseServidor>>;
type ImagenGuardada = { ruta: string } | { error: string; errorImagen?: string };

async function subirImagenProducto(supabase: ClienteSupabase, productoId: string, archivo: File): Promise<ImagenGuardada> {
  const errorArchivo = validarArchivoImagenProducto(archivo);
  if (errorArchivo) return { error: errorArchivo, errorImagen: errorArchivo };

  const contenido = Buffer.from(await archivo.arrayBuffer());
  try {
    const imagen = sharp(contenido, { animated: true, failOn: "warning", limitInputPixels: 16_000_000 });
    const metadata = await imagen.metadata();
    if (metadata.format !== "webp") throw new Error("Formato inválido");
    await imagen.raw().toBuffer();
  } catch {
    const error = "El archivo debe ser un WebP válido de hasta 16 megapíxeles en total.";
    return { error, errorImagen: error };
  }

  const bucket = supabase.storage.from(BUCKET_IMAGEN_PRODUCTO);
  const { data, error } = await bucket.upload(`${productoId}/${randomUUID()}.webp`, contenido, {
    contentType: TIPO_IMAGEN_PRODUCTO,
    upsert: false,
    cacheControl: "31536000",
  });
  if (error) return { error: "No se pudo subir la imagen. Revisa los permisos y la configuración del almacenamiento." };
  return { ruta: bucket.getPublicUrl(data.path).data.publicUrl };
}

function revalidarProducto(id: string, slug: string) {
  revalidatePath(ROUTES.admin);
  revalidatePath(ROUTES.adminProducts);
  revalidatePath(ROUTES.adminProduct(id));
  revalidatePath(ROUTES.adminPublicManager);
  revalidatePath(ROUTES.home);
  revalidatePath(ROUTES.catalog);
  revalidatePath(ROUTES.product(slug));
}

export async function reemplazarImagenProducto(id: string, rutaAnterior: string | null, datos: FormData): Promise<ImagenGuardada> {
  const supabase = await crearClienteSupabaseServidor();
  const { data: sesion } = await supabase.auth.getUser();
  if (!sesion.user) return { error: "Tu sesión expiró. Inicia sesión nuevamente." };
  const { data: admin } = await supabase.rpc("es_admin");
  if (admin !== true) return { error: "No tienes permisos para reemplazar imágenes." };

  const archivo = datos.get("imagen");
  if (!(archivo instanceof File)) return { error: "Selecciona una imagen para guardar." };
  const actual = await supabase.from("productos").select("id, ruta_imagen").eq("id", id).maybeSingle();
  if (actual.error || !actual.data) return { error: "No se pudo encontrar el producto." };
  const conflicto = "La imagen cambió desde que abriste el editor. Vuelve a abrirlo antes de reintentar.";
  if (actual.data.ruta_imagen !== rutaAnterior) return { error: conflicto };

  const subida = await subirImagenProducto(supabase, actual.data.id, archivo);
  if ("error" in subida) return subida;

  // El objeto anterior queda disponible. Una respuesta ambigua tampoco debe provocar un borrado.
  const cambio = supabase.from("productos").update({ ruta_imagen: subida.ruta }).eq("id", id);
  const { data, error } = await (rutaAnterior === null
    ? cambio.is("ruta_imagen", null)
    : cambio.eq("ruta_imagen", rutaAnterior)).select("slug").maybeSingle();
  if (error) return { error: "No se pudo confirmar el cambio de imagen. Reabre el editor para comprobar el resultado." };
  if (!data) return { error: conflicto };

  revalidarProducto(id, data.slug);
  return subida;
}

const mensajesRpc: Record<string, string> = {
  IMAGEN_PRODUCTO_INVALIDA: "No se pudo vincular la imagen cargada con el producto.",
  ETIQUETA_PRODUCTO_INVALIDA: "Elige una sola etiqueta.",
  NO_AUTORIZADO: "No tienes permisos para guardar productos.",
  CATEGORIA_INVALIDA: "Selecciona una categoría activa.",
  NOMBRE_REQUERIDO: "El nombre del producto es obligatorio.",
  SLUG_INVALIDO: "El slug debe usar minúsculas, números y guiones.",
  PRESENTACION_REQUERIDA: "El nombre de la presentación es obligatorio.",
  UNIDAD_INVALIDA: "La unidad debe ser KG, GR o UND.",
  CANTIDAD_INVALIDA: "La cantidad de la presentación debe ser mayor que cero.",
  PRECIO_INVALIDO: "Los precios deben ser no negativos y el precio final no puede ser menor que el neto.",
  PRESENTACION_PRINCIPAL_REQUERIDA: "La presentación principal debe permanecer activa.",
  PRODUCTO_INEXISTENTE: "El producto que intentas editar ya no existe.",
};

export async function guardarProductoAdmin(_: EstadoGuardadoProducto, datos: FormData): Promise<EstadoGuardadoProducto> {
  const resultado = await guardarProducto(datos);
  if ("error" in resultado) return resultado;
  redirect(ROUTES.adminProduct(resultado.id));
}

export async function guardarProductoEnGestor(datos: FormData): Promise<EstadoGuardadoProducto> {
  if (!texto(datos, "id")) return { error: "Selecciona un producto para editar." };
  const resultado = await guardarProducto(datos);
  return "error" in resultado ? resultado : {};
}

async function guardarProducto(datos: FormData): Promise<{ id: string } | { error: string; errorImagen?: string }> {
  const supabase = await crearClienteSupabaseServidor();
  const { data: sesion } = await supabase.auth.getUser();
  if (!sesion.user) return { error: "Tu sesión expiró. Inicia sesión nuevamente." };
  const precioNeto = entero(datos, "precioNeto"); const precioFinal = entero(datos, "precioFinal"); const cantidad = Number(texto(datos, "cantidad")); const orden = entero(datos, "orden");
  if (![precioNeto, precioFinal, cantidad, orden].every(Number.isFinite) || !Number.isInteger(precioNeto) || !Number.isInteger(precioFinal) || precioNeto < 0 || precioFinal < 0 || precioFinal < precioNeto || cantidad <= 0) return { error: "La cantidad debe ser mayor que cero y el precio final no puede ser menor que el neto." };
  const etiqueta = texto(datos, "etiqueta");
  if (!["ninguna", "destacado", "nuevo", "masVendido"].includes(etiqueta)) {
    return { error: "Selecciona una etiqueta o elige Sin etiqueta." };
  }

  const id = texto(datos, "id") || null;
  const slug = texto(datos, "slug");
  let rutaImagen: string | null = null;
  const archivo = datos.get("imagen");
  if (!id && archivo instanceof File && archivo.name) {
    const { data: admin } = await supabase.rpc("es_admin");
    if (admin !== true) return { error: "No tienes permisos para subir imágenes." };
    const subida = await subirImagenProducto(supabase, randomUUID(), archivo);
    if ("error" in subida) return subida;
    rutaImagen = subida.ruta;
  }

  const { data, error } = await supabase.rpc("guardar_producto_administrativo", {
    p_producto_id: id,
    p_categoria_id: texto(datos, "categoriaId"),
    p_nombre: texto(datos, "nombre"),
    p_slug: slug,
    p_descripcion: texto(datos, "descripcion"),
    p_ruta_imagen: rutaImagen,
    p_activo: datos.get("activo") === "on",
    p_disponible: datos.get("disponible") === "on",
    p_destacado: etiqueta === "destacado",
    p_mas_vendido: etiqueta === "masVendido",
    p_nuevo: etiqueta === "nuevo",
    p_orden: orden,
    p_presentacion_nombre: texto(datos, "presentacionNombre"),
    p_cantidad: cantidad,
    p_unidad: texto(datos, "unidad"),
    p_precio_neto: precioNeto,
    p_precio_final: precioFinal,
    p_presentacion_activa: true,
  });
  if (error) return { error: error.code === "23505" ? "El slug ya está en uso." : mensajesRpc[error.message] ?? "Hubo un problema al guardar el producto." };
  revalidarProducto(data, slug);
  return { id: data };
}
