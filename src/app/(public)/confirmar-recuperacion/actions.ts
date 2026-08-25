"use server";

import { redirect } from "next/navigation";

import { obtenerReturnToAutenticacionSeguro } from "@/lib/account/return-to";
import { hrefActualizarContrasena } from "@/lib/auth/password-recovery";
import { crearClienteSupabaseServidor } from "@/lib/supabase/server";

const tokenHashValido = /^[A-Za-z0-9_-]{20,512}$/;

type MotivoFalloRecovery = "otp_expired_o_consumido" | "token_invalido" | "sesion_no_persistida" | "error_tecnico";

function registrarFalloRecovery(motivo: MotivoFalloRecovery, error?: { code?: string; status?: number }) {
  if (process.env.NODE_ENV === "development") {
    console.warn("[password-recovery] verifyOtp no completó recovery", { motivo, code: error?.code, status: error?.status });
  }
}

function clasificarErrorVerifyOtp(error: { code?: string; status?: number }): MotivoFalloRecovery {
  if (error.code === "otp_expired") return "otp_expired_o_consumido";
  if (error.code === "otp_invalid" || error.code === "token_invalid") return "token_invalido";
  return "error_tecnico";
}

export async function confirmarEnlaceRecuperacion(datos: FormData) {
  const tokenHash = String(datos.get("tokenHash") ?? "");
  const returnTo = obtenerReturnToAutenticacionSeguro(String(datos.get("returnTo") ?? "")) ?? undefined;
  if (!tokenHashValido.test(tokenHash)) {
    registrarFalloRecovery("token_invalido");
    redirect(hrefActualizarContrasena(returnTo, true));
  }

  let supabase: Awaited<ReturnType<typeof crearClienteSupabaseServidor>>;
  let resultado: Awaited<ReturnType<typeof supabase.auth.verifyOtp>>;
  try {
    supabase = await crearClienteSupabaseServidor();
    resultado = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" });
  } catch {
    registrarFalloRecovery("error_tecnico");
    redirect(hrefActualizarContrasena(returnTo, true));
  }

  if (resultado.error) {
    registrarFalloRecovery(clasificarErrorVerifyOtp(resultado.error), resultado.error);
    redirect(hrefActualizarContrasena(returnTo, true));
  }
  if (!resultado.data.session) {
    registrarFalloRecovery("sesion_no_persistida");
    redirect(hrefActualizarContrasena(returnTo, true));
  }

  const { data: { user }, error: errorUsuario } = await supabase.auth.getUser();
  if (errorUsuario || !user) {
    registrarFalloRecovery("sesion_no_persistida", errorUsuario ?? undefined);
    redirect(hrefActualizarContrasena(returnTo, true));
  }

  redirect(hrefActualizarContrasena(returnTo));
}
