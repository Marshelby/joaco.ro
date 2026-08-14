"use server";

import { revalidatePath } from "next/cache";

import { crearClienteSupabaseServidor } from "@/lib/supabase/server";

export type EstadoCuenta = { error?: string; exito?: string };

const mensajesRpc: Record<string, string> = {
  NO_AUTORIZADO: "Tu sesión expiró. Inicia sesión nuevamente.",
  CLIENTE_NO_ENCONTRADO: "No tienes una cuenta de cliente activa.",
  NOMBRE_REQUERIDO: "El nombre es obligatorio.",
  DIRECCION_NO_ENCONTRADA: "La dirección ya no está disponible.",
  DIRECCION_INVALIDA: "Completa dirección, comuna y región.",
};

const texto = (datos: FormData, campo: string) => String(datos.get(campo) ?? "").trim();

function revalidarCuenta() {
  revalidatePath("/");
  revalidatePath("/mi-cuenta");
  revalidatePath("/mi-cuenta/direcciones");
}

export async function actualizarPerfilCliente(_: EstadoCuenta, datos: FormData): Promise<EstadoCuenta> {
  const supabase = await crearClienteSupabaseServidor();
  const { data: sesion } = await supabase.auth.getUser();
  if (!sesion.user) return { error: mensajesRpc.NO_AUTORIZADO };

  const { error } = await supabase.rpc("actualizar_perfil_cliente", {
    p_nombre: texto(datos, "nombre"),
    p_telefono: texto(datos, "telefono") || null,
  });
  if (error) return { error: mensajesRpc[error.message] ?? "No fue posible guardar tus datos." };

  revalidarCuenta();
  return { exito: "Datos actualizados." };
}

export async function guardarDireccionCliente(_: EstadoCuenta, datos: FormData): Promise<EstadoCuenta> {
  const supabase = await crearClienteSupabaseServidor();
  const { data: sesion } = await supabase.auth.getUser();
  if (!sesion.user) return { error: mensajesRpc.NO_AUTORIZADO };

  const { error } = await supabase.rpc("guardar_direccion_cliente", {
    p_direccion_id: texto(datos, "direccionId") || null,
    p_nombre: texto(datos, "nombre") || null,
    p_destinatario: texto(datos, "destinatario") || null,
    p_telefono_contacto: texto(datos, "telefonoContacto") || null,
    p_direccion: texto(datos, "direccion"),
    p_comuna: texto(datos, "comuna"),
    p_region: texto(datos, "region"),
    p_referencia: texto(datos, "referencia") || null,
    p_es_principal: datos.get("esPrincipal") === "on",
  });
  if (error) return { error: mensajesRpc[error.message] ?? "No fue posible guardar la dirección." };

  revalidarCuenta();
  return { exito: "Dirección guardada." };
}

export async function desactivarDireccionCliente(_: EstadoCuenta, datos: FormData): Promise<EstadoCuenta> {
  const direccionId = texto(datos, "direccionId");
  if (!direccionId) return { error: "No fue posible identificar la dirección." };

  const supabase = await crearClienteSupabaseServidor();
  const { data: sesion } = await supabase.auth.getUser();
  if (!sesion.user) return { error: mensajesRpc.NO_AUTORIZADO };

  const { error } = await supabase.rpc("desactivar_direccion_cliente", { p_direccion_id: direccionId });
  if (error) return { error: mensajesRpc[error.message] ?? "No fue posible desactivar la dirección." };

  revalidarCuenta();
  return { exito: "Dirección desactivada." };
}
