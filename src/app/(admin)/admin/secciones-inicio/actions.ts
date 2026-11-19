"use server";

import { revalidatePath } from "next/cache";

import { isHomeSectionIcon } from "@/lib/home-section-icons";
import { crearClienteSupabaseServidor } from "@/lib/supabase/server";

export type EstadoSeccionInicio = { error?: string; exito?: string };

const slugValido = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const mensajesRpc: Record<string, string> = {
  NO_AUTORIZADO: "No tienes permisos para administrar las secciones de inicio.",
  SECCION_INICIO_INVALIDA: "La sección seleccionada ya no está disponible.",
  SECCION_EN_EXTREMO: "La sección ya está en ese extremo de la lista.",
  NOMBRE_INVALIDO: "Ingresa un nombre de hasta 120 caracteres.",
  DESCRIPCION_INVALIDA: "La descripción puede tener hasta 500 caracteres.",
  ICONO_INVALIDO: "Selecciona un ícono válido.",
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
  if (!slugValido.test(seccionSlug) || !productoId) return { error: "Selecciona una sección y un producto válidos." };

  const supabase = await obtenerClienteAdmin();
  if (!supabase) return { error: mensajesRpc.NO_AUTORIZADO };

  const { error } = await supabase.rpc("agregar_producto_seccion_inicio_administrativa", {
    p_seccion_slug: seccionSlug,
    p_producto_id: productoId,
  });
  if (error) return { error: mensajeError(error.message) };

  revalidarSeccionesInicio();
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

  revalidarSeccionesInicio();
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

  revalidarSeccionesInicio();
  return { exito: "Orden actualizado." };
}

function revalidarSeccionesInicio() {
  revalidatePath("/admin/secciones-inicio");
  revalidatePath("/admin/gestor-publico");
  revalidatePath("/");
}

export async function gestionarSeccionInicio(
  _: EstadoSeccionInicio,
  datos: FormData,
): Promise<EstadoSeccionInicio> {
  const operacion = texto(datos, "operacion");
  const slug = texto(datos, "seccionSlug");
  if (operacion !== "crear" && !slugValido.test(slug)) return { error: mensajesRpc.SECCION_INICIO_INVALIDA };

  const parametros: {
    p_operacion: string;
    p_slug?: string;
    p_nombre?: string;
    p_descripcion?: string;
    p_icono?: string;
    p_activa?: boolean;
    p_direccion?: string;
  } = { p_operacion: operacion, p_slug: slug || undefined };

  let exito: string;
  switch (operacion) {
    case "crear":
    case "editar": {
      const nombre = texto(datos, "nombre");
      const descripcion = texto(datos, "descripcion");
      const icono = texto(datos, "icono");
      if (!nombre || nombre.length > 120) return { error: mensajesRpc.NOMBRE_INVALIDO };
      if (descripcion.length > 500) return { error: mensajesRpc.DESCRIPCION_INVALIDA };
      if (!isHomeSectionIcon(icono)) return { error: mensajesRpc.ICONO_INVALIDO };
      parametros.p_nombre = nombre;
      parametros.p_descripcion = descripcion;
      parametros.p_icono = icono;
      exito = operacion === "crear" ? "Sección creada." : "Sección guardada.";
      break;
    }
    case "visibilidad": {
      const activa = texto(datos, "activa");
      if (activa !== "true" && activa !== "false") return { error: "Selecciona un estado válido." };
      parametros.p_activa = activa === "true";
      exito = parametros.p_activa ? "Sección activada." : "Sección desactivada.";
      break;
    }
    case "eliminar":
      exito = "Sección eliminada.";
      break;
    case "mover": {
      const direccion = texto(datos, "direccion");
      if (direccion !== "arriba" && direccion !== "abajo") return { error: mensajesRpc.DIRECCION_INVALIDA };
      parametros.p_direccion = direccion;
      exito = "Orden actualizado.";
      break;
    }
    default:
      return { error: "Selecciona una operación válida." };
  }

  const supabase = await obtenerClienteAdmin();
  if (!supabase) return { error: mensajesRpc.NO_AUTORIZADO };

  const { error } = await supabase.rpc("gestionar_seccion_inicio_administrativa", parametros);
  if (error) return { error: mensajeError(error.message) };

  revalidarSeccionesInicio();
  return { exito };
}
