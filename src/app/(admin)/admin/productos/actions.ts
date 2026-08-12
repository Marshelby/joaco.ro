"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { crearClienteSupabaseServidor } from "@/lib/supabase/server";

export type EstadoGuardadoProducto = { error?: string };

const texto = (datos: FormData, campo: string) => String(datos.get(campo) ?? "").trim();
const entero = (datos: FormData, campo: string) => Number(texto(datos, campo));
const mensajesRpc: Record<string, string> = {
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
  const supabase = await crearClienteSupabaseServidor();
  const { data: sesion } = await supabase.auth.getUser();
  if (!sesion.user) return { error: "Tu sesión expiró. Inicia sesión nuevamente." };
  const precioNeto = entero(datos, "precioNeto"); const precioFinal = entero(datos, "precioFinal"); const cantidad = Number(texto(datos, "cantidad")); const orden = entero(datos, "orden");
  if (![precioNeto, precioFinal, cantidad, orden].every(Number.isFinite) || !Number.isInteger(precioNeto) || !Number.isInteger(precioFinal) || precioNeto < 0 || precioFinal < 0 || precioFinal < precioNeto || cantidad <= 0) return { error: "La cantidad debe ser mayor que cero y el precio final no puede ser menor que el neto." };
  const { data, error } = await supabase.rpc("guardar_producto_administrativo", {
    p_producto_id: texto(datos, "id") || null, p_categoria_id: texto(datos, "categoriaId"), p_nombre: texto(datos, "nombre"), p_slug: texto(datos, "slug"), p_descripcion: texto(datos, "descripcion"), p_ruta_imagen: texto(datos, "rutaImagen"), p_activo: datos.get("activo") === "on", p_disponible: datos.get("disponible") === "on", p_destacado: datos.get("destacado") === "on", p_mas_vendido: datos.get("masVendido") === "on", p_nuevo: datos.get("nuevo") === "on", p_orden: orden, p_presentacion_nombre: texto(datos, "presentacionNombre"), p_cantidad: cantidad, p_unidad: texto(datos, "unidad"), p_precio_neto: precioNeto, p_precio_final: precioFinal, p_presentacion_activa: true,
  });
  if (error) return { error: error.code === "23505" ? "El slug ya está en uso." : mensajesRpc[error.message] ?? "Hubo un problema al guardar el producto." };
  revalidatePath("/admin"); revalidatePath("/admin/productos"); revalidatePath(`/admin/productos/${data}`); revalidatePath("/"); revalidatePath("/catalogo");
  redirect(`/admin/productos/${data}`);
}
