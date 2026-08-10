"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { crearClienteSupabaseServidor } from "@/lib/supabase/server";

export type EstadoGuardadoProducto = { error?: string };

const texto = (datos: FormData, campo: string) => String(datos.get(campo) ?? "").trim();
const entero = (datos: FormData, campo: string) => Number(texto(datos, campo));

export async function guardarProductoAdmin(_: EstadoGuardadoProducto, datos: FormData): Promise<EstadoGuardadoProducto> {
  const supabase = await crearClienteSupabaseServidor();
  const { data: sesion } = await supabase.auth.getUser();
  if (!sesion.user) return { error: "Tu sesión expiró. Inicia sesión nuevamente." };
  const precioNeto = entero(datos, "precioNeto"); const precioFinal = entero(datos, "precioFinal"); const cantidad = Number(texto(datos, "cantidad")); const orden = entero(datos, "orden");
  if (![precioNeto, precioFinal, cantidad, orden].every(Number.isFinite) || !Number.isInteger(precioNeto) || !Number.isInteger(precioFinal) || precioNeto < 0 || precioFinal < 0 || cantidad <= 0) return { error: "Revisa cantidades, orden y precios enteros no negativos." };
  const { data, error } = await supabase.rpc("guardar_producto_administrativo", {
    p_producto_id: texto(datos, "id") || null, p_categoria_id: texto(datos, "categoriaId"), p_nombre: texto(datos, "nombre"), p_slug: texto(datos, "slug"), p_descripcion: texto(datos, "descripcion"), p_ruta_imagen: texto(datos, "rutaImagen"), p_activo: datos.get("activo") === "on", p_disponible: datos.get("disponible") === "on", p_destacado: datos.get("destacado") === "on", p_mas_vendido: datos.get("masVendido") === "on", p_nuevo: datos.get("nuevo") === "on", p_orden: orden, p_presentacion_nombre: texto(datos, "presentacionNombre"), p_cantidad: cantidad, p_unidad: texto(datos, "unidad"), p_precio_neto: precioNeto, p_precio_final: precioFinal, p_presentacion_activa: datos.get("presentacionActiva") === "on",
  });
  if (error) return { error: error.code === "23505" ? "El slug ya está en uso." : "Hubo un problema al guardar el producto." };
  revalidatePath("/admin"); revalidatePath("/admin/productos"); revalidatePath(`/admin/productos/${data}`); revalidatePath("/"); revalidatePath("/catalogo");
  redirect(`/admin/productos/${data}`);
}
