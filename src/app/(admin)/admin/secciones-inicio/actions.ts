"use server";

import { revalidatePath } from "next/cache";

import { crearClienteSupabaseServidor } from "@/lib/supabase/server";

export type EstadoSeccionInicio = { error?: string; exito?: string };

const seccionesValidas = new Set(["featured", "best-sellers", "opportunities", "new-arrivals"]);
const mensajesRpc: Record<string, string> = {
  NO_AUTORIZADO: "No tienes permisos para administrar las secciones de inicio.",
  SECCION_INICIO_INVALIDA: "La sección seleccionada no es válida.",
  PRODUCTO_INVALIDO: "No fue posible identificar el producto.",
  PRODUCTO_NO_DISPONIBLE: "Este producto ya no está activo o disponible.",
  PRODUCTO_YA_ASIGNADO: "Este producto ya está en esta sección.",
  ASIGNACION_INEXISTENTE: "Esta asignación ya no está disponible.",
  DIRECCION_INVALIDA: "No fue posible determinar el movimiento.",
};

function texto(datos: FormData, campo: string) {
  return String(datos.get(campo) ?? "").trim();
}

async function obtenerClienteAdmin() {
  const supabase = await crearClienteSupabaseServidor();
  const { data: sesion, error: errorSesion } = await supabase.auth.getUser();
  if (errorSesion || !sesion.user) return null;

  const { data: perfil, error: errorPerfil } = await supabase
    .from("perfiles")
    .select("rol")
    .eq("usuario_id", sesion.user.id)
    .maybeSingle();
  if (errorPerfil || perfil?.rol !== "admin") return null;
  return supabase;
}

function mensajeError(codigo: string) {
  return mensajesRpc[codigo] ?? "No fue posible actualizar esta sección. Inténtalo nuevamente.";
}

export async function agregarProductoSeccionInicio(
  _: EstadoSeccionInicio,
  datos: FormData,
): Promise<EstadoSeccionInicio> {
  const seccionSlug = texto(datos, "seccionSlug");
  const productoId = texto(datos, "productoId");
  if (!seccionesValidas.has(seccionSlug) || !productoId) return { error: "Selecciona una sección y un producto válidos." };

  const supabase = await obtenerClienteAdmin();
  if (!supabase) return { error: mensajesRpc.NO_AUTORIZADO };

  const { error } = await supabase.rpc("agregar_producto_seccion_inicio_administrativa", {
    p_seccion_slug: seccionSlug,
    p_producto_id: productoId,
  });
  if (error) return { error: mensajeError(error.message) };

  revalidatePath("/admin/secciones-inicio");
  revalidatePath("/");
  return { exito: "Producto agregado." };
}

export async function quitarProductoSeccionInicio(
  _: EstadoSeccionInicio,
  datos: FormData,
): Promise<EstadoSeccionInicio> {
  const asignacionId = texto(datos, "asignacionId");
  if (!asignacionId) return { error: "No fue posible identificar la asignación." };

  const supabase = await obtenerClienteAdmin();
  if (!supabase) return { error: mensajesRpc.NO_AUTORIZADO };

  const { error } = await supabase.rpc("quitar_producto_seccion_inicio_administrativa", { p_asignacion_id: asignacionId });
  if (error) return { error: mensajeError(error.message) };

  revalidatePath("/admin/secciones-inicio");
  revalidatePath("/");
  return { exito: "Producto quitado." };
}

export async function moverProductoSeccionInicio(
  _: EstadoSeccionInicio,
  datos: FormData,
): Promise<EstadoSeccionInicio> {
  const asignacionId = texto(datos, "asignacionId");
  const direccion = texto(datos, "direccion");
  if (!asignacionId || (direccion !== "arriba" && direccion !== "abajo")) return { error: "No fue posible determinar el movimiento." };

  const supabase = await obtenerClienteAdmin();
  if (!supabase) return { error: mensajesRpc.NO_AUTORIZADO };

  const { data, error } = await supabase.rpc("mover_producto_seccion_inicio_administrativa", {
    p_asignacion_id: asignacionId,
    p_direccion: direccion,
  });
  if (error) return { error: mensajeError(error.message) };
  if (data !== true) return { error: "El producto ya está en ese extremo de la sección." };

  revalidatePath("/admin/secciones-inicio");
  revalidatePath("/");
  return { exito: "Orden actualizado." };
}
