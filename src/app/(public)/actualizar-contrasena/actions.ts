"use server";

import { redirect } from "next/navigation";

import { obtenerReturnToAutenticacionSeguro } from "@/lib/account/return-to";
import { crearClienteSupabaseServidor } from "@/lib/supabase/server";

export type EstadoActualizarContrasena = {
  error?: "enlace_invalido" | "coincidencia" | "debil" | "demasiados_intentos" | "tecnico";
};

const longitudMinima = 8;

function hrefInicioSesionPostRecuperacion(returnTo: string | undefined) {
  const parametros = new URLSearchParams({ modo: "iniciar", mensaje: "contrasena_actualizada" });
  const destino = obtenerReturnToAutenticacionSeguro(returnTo);
  if (destino) parametros.set("returnTo", destino);
  return `/iniciar-sesion?${parametros.toString()}`;
}

function registrarDiagnostico(fase: "getUser" | "updateUser" | "signOut", detalle: { hasUser?: boolean; code?: string; status?: number; success?: boolean }) {
  if (process.env.NODE_ENV === "development") console.warn("[password-recovery]", { fase, ...detalle });
}

export async function actualizarContrasena(
  _estadoAnterior: EstadoActualizarContrasena,
  datos: FormData,
): Promise<EstadoActualizarContrasena> {
  const password = String(datos.get("password") ?? "");
  const confirmarPassword = String(datos.get("confirmarPassword") ?? "");
  const returnTo = obtenerReturnToAutenticacionSeguro(String(datos.get("returnTo") ?? "")) ?? undefined;

  if (!password || password.length < longitudMinima) return { error: "debil" };
  if (password !== confirmarPassword) return { error: "coincidencia" };

  let supabase: Awaited<ReturnType<typeof crearClienteSupabaseServidor>>;
  try {
    supabase = await crearClienteSupabaseServidor();
    const { data: { user }, error: errorUsuario } = await supabase.auth.getUser();
    registrarDiagnostico("getUser", { hasUser: Boolean(user), code: errorUsuario?.code, status: errorUsuario?.status });
    if (errorUsuario || !user) return { error: "enlace_invalido" };

    const { error } = await supabase.auth.updateUser({ password });
    registrarDiagnostico("updateUser", { code: error?.code, status: error?.status, success: !error });
    if (error) {
      if (error.code === "weak_password" || error.code === "same_password") return { error: "debil" };
      if (error.status === 429 || error.code === "over_request_rate_limit") return { error: "demasiados_intentos" };
      return { error: "tecnico" };
    }

  } catch {
    return { error: "tecnico" };
  }

  try {
    const { error: errorCerrarSesion } = await supabase.auth.signOut();
    registrarDiagnostico("signOut", { code: errorCerrarSesion?.code, status: errorCerrarSesion?.status, success: !errorCerrarSesion });
    if (errorCerrarSesion) return { error: "tecnico" };
  } catch {
    return { error: "tecnico" };
  }

  redirect(hrefInicioSesionPostRecuperacion(returnTo));
}
