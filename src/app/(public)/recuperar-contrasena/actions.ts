"use server";

import { redirect } from "next/navigation";

import { obtenerReturnToAutenticacionSeguro } from "@/lib/account/return-to";
import { obtenerOrigenAplicacion } from "@/lib/auth/app-origin";
import { hrefRecuperacionEnviada } from "@/lib/auth/password-recovery";
import { crearClienteSupabaseServidor } from "@/lib/supabase/server";

export type EstadoRecuperacionContrasena = {
  error?: "correo" | "demasiados_intentos" | "verificacion" | "tecnico";
  email?: string;
};

const correoValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function texto(datos: FormData, campo: string) {
  return String(datos.get(campo) ?? "").trim();
}

function estadoError(error: { code?: string; status?: number }, email: string): EstadoRecuperacionContrasena | null {
  if (error.status === 429 || error.code === "over_request_rate_limit") return { error: "demasiados_intentos", email };
  if (error.code === "captcha_failed") return { error: "verificacion", email };
  return null;
}

export async function enviarEnlaceRecuperacion(
  _estadoAnterior: EstadoRecuperacionContrasena,
  datos: FormData,
): Promise<EstadoRecuperacionContrasena> {
  const email = texto(datos, "email").toLowerCase();
  const captchaToken = String(datos.get("captchaToken") ?? "");
  const returnTo = obtenerReturnToAutenticacionSeguro(texto(datos, "returnTo")) ?? undefined;

  if (!correoValido.test(email)) return { error: "correo", email };

  let redirectTo: string;
  try {
    const callback = new URL("/auth/callback", await obtenerOrigenAplicacion());
    callback.searchParams.set("flow", "recovery");
    if (returnTo) callback.searchParams.set("returnTo", returnTo);
    redirectTo = callback.toString();
  } catch {
    return { error: "tecnico", email };
  }

  try {
    const supabase = await crearClienteSupabaseServidor();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
      captchaToken: captchaToken || undefined,
    });
    if (error) {
      const estado = estadoError(error, email);
      if (estado) return estado;
    }
  } catch {
    // La respuesta pública se mantiene igual para no revelar la existencia de una cuenta.
  }

  redirect(hrefRecuperacionEnviada(email, returnTo));
}
