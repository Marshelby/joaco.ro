"use server";

import { revalidatePath } from "next/cache";

import { obtenerTokenInvitacionSeguro } from "@/lib/account/return-to";
import { crearClienteSupabaseServidor } from "@/lib/supabase/server";

export type EstadoAceptacionInvitacion = { error?: string; exito?: string; yaAceptada?: boolean };

const mensajesRpc: Record<string, string> = {
  NO_AUTORIZADO: "Debes iniciar sesión con la cuenta autorizada para aceptar esta invitación.",
  PERFIL_INVALIDO: "Esta cuenta no puede aceptar invitaciones de clientes.",
  CORREO_NO_VERIFICADO: "Confirma el correo de esta cuenta antes de aceptar la invitación.",
  INVITACION_INVALIDA: "El enlace de invitación no es válido.",
  INVITACION_REVOCADA: "Esta invitación fue revocada.",
  INVITACION_EXPIRADA: "Esta invitación expiró. Solicita un nuevo enlace a Hidro Leufú.",
  INVITACION_NO_DISPONIBLE: "Esta invitación ya no está disponible.",
  CORREO_NO_COINCIDE: "Esta invitación corresponde a otra cuenta de correo.",
  CLIENTE_INACTIVO: "La cuenta comercial no está habilitada para acceso web.",
  CLIENTE_YA_VINCULADO: "Esta cuenta comercial ya tiene acceso web activo.",
  CUENTA_CLIENTE_EXISTENTE_CON_HISTORIAL: "Tu cuenta ya tiene historial comercial. Contacta a Hidro Leufú para completar la vinculación de forma segura.",
};

export async function aceptarInvitacionCliente(_: EstadoAceptacionInvitacion, datos: FormData): Promise<EstadoAceptacionInvitacion> {
  const token = obtenerTokenInvitacionSeguro(String(datos.get("token") ?? ""));
  if (!token) return { error: "El enlace de invitación no es válido." };
  const supabase = await crearClienteSupabaseServidor();
  const { data: sesion } = await supabase.auth.getUser();
  if (!sesion.user) return { error: mensajesRpc.NO_AUTORIZADO };
  const { data, error } = await supabase.rpc("aceptar_invitacion_acceso_cliente", { p_token: token });
  if (error) return { error: mensajesRpc[error.message] ?? "No pudimos vincular tu cuenta. Inténtalo nuevamente." };
  const resultado = Array.isArray(data) ? data[0] : data;
  if (!resultado?.cliente_id) return { error: "No pudimos vincular tu cuenta. Inténtalo nuevamente." };
  revalidatePath("/mi-cuenta");
  revalidatePath("/mi-cuenta/pedidos");
  revalidatePath("/mi-cuenta/direcciones");
  return { exito: resultado.ya_aceptada ? "Esta invitación ya había sido aceptada por tu cuenta." : "Tu cuenta fue vinculada correctamente.", yaAceptada: Boolean(resultado.ya_aceptada) };
}
