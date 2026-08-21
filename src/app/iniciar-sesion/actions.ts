"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { resolverDestinoPostAuth } from "@/lib/account/post-auth";
import { hrefConfirmarCorreo } from "@/lib/auth/email-confirmation";
import { obtenerReturnToAutenticacionSeguro } from "@/lib/account/return-to";
import { crearClienteSupabaseServidor } from "@/lib/supabase/server";

type ModoAcceso = "iniciar" | "crear";

export type EstadoInicioSesion = {
  error?: "credenciales" | "demasiados_intentos" | "verificacion" | "tecnico";
  email?: string;
};

function hrefAcceso({ modo, error, mensaje, returnTo }: { modo: ModoAcceso; error?: string; mensaje?: string; returnTo: string | undefined }) {
  const parametros = new URLSearchParams({ modo });
  const destino = obtenerReturnToAutenticacionSeguro(returnTo);
  if (destino) parametros.set("returnTo", destino);
  if (error) parametros.set("error", error);
  if (mensaje) parametros.set("mensaje", mensaje);
  return `/iniciar-sesion?${parametros.toString()}`;
}

function obtenerTexto(datos: FormData, campo: string) {
  return String(datos.get(campo) ?? "").trim();
}

async function resolverRedireccionPostAuth(
  supabase: Awaited<ReturnType<typeof crearClienteSupabaseServidor>>,
  returnTo: string | undefined,
  modo: ModoAcceso,
): Promise<never> {
  let resultado: Awaited<ReturnType<typeof resolverDestinoPostAuth>>;
  try {
    resultado = await resolverDestinoPostAuth(
      () => supabase.rpc("ensure_cuenta_cliente_actual"),
      returnTo,
    );
  } catch {
    redirect(hrefAcceso({ modo, error: "cuenta", returnTo }));
  }
  if (resultado.estado === "cliente_inactivo") redirect(hrefAcceso({ modo, error: "cuenta", returnTo }));
  redirect(resultado.destino);
}

async function obtenerOrigenAplicacion() {
  const encabezados = await headers();
  const origin = encabezados.get("origin");
  if (origin) {
    const url = new URL(origin);
    if (url.protocol === "https:" || url.protocol === "http:") return url.origin;
  }

  const host = encabezados.get("x-forwarded-host") ?? encabezados.get("host");
  if (!host || host.includes("/")) throw new Error("No fue posible determinar el origen de la aplicación.");
  const protocol = encabezados.get("x-forwarded-proto") === "https" ? "https" : "http";
  return `${protocol}://${host}`;
}

function estadoErrorInicioSesion(error: { code?: string; status?: number }, email: string): EstadoInicioSesion {
  if (error.status === 429 || error.code === "over_request_rate_limit") {
    return { error: "demasiados_intentos", email };
  }
  if (error.code === "captcha_failed") return { error: "verificacion", email };
  if (error.code === "invalid_credentials") return { error: "credenciales", email };
  return { error: "tecnico", email };
}

export async function iniciarSesion(_estadoAnterior: EstadoInicioSesion, datos: FormData): Promise<EstadoInicioSesion> {
  const email = obtenerTexto(datos, "email").toLowerCase();
  const password = String(datos.get("password") ?? "");
  const captchaToken = String(datos.get("captchaToken") ?? "");
  const returnTo = String(datos.get("returnTo") ?? "");
  const supabase = await crearClienteSupabaseServidor();
  let error: Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>["error"];
  try {
    ({ error } = await supabase.auth.signInWithPassword({ email, password, options: { captchaToken: captchaToken || undefined } }));
  } catch {
    return { error: "tecnico", email };
  }

  if (error) return estadoErrorInicioSesion(error, email);
  return await resolverRedireccionPostAuth(supabase, returnTo, "iniciar");
}

export async function crearCuenta(datos: FormData) {
  const nombre = obtenerTexto(datos, "nombre");
  const email = obtenerTexto(datos, "email").toLowerCase();
  const password = String(datos.get("password") ?? "");
  const confirmarPassword = String(datos.get("confirmarPassword") ?? "");
  const captchaToken = String(datos.get("captchaToken") ?? "");
  const returnTo = String(datos.get("returnTo") ?? "");

  if (!nombre || !email || password.length < 8 || password !== confirmarPassword) {
    redirect(hrefAcceso({ modo: "crear", error: "registro", returnTo }));
  }

  const supabase = await crearClienteSupabaseServidor();
  let emailRedirectTo: string;
  try {
    const origen = await obtenerOrigenAplicacion();
    const callback = new URL("/auth/callback", origen);
    const destino = obtenerReturnToAutenticacionSeguro(returnTo);
    if (destino) callback.searchParams.set("returnTo", destino);
    emailRedirectTo = callback.toString();
  } catch {
    redirect(hrefAcceso({ modo: "crear", error: "registro", returnTo }));
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: nombre }, emailRedirectTo, captchaToken: captchaToken || undefined },
  });

  if (error) redirect(hrefAcceso({ modo: "crear", error: error.code === "captcha_failed" ? "verificacion" : "registro", returnTo }));
  if (!data.session) redirect(hrefConfirmarCorreo(email, returnTo));
  await resolverRedireccionPostAuth(supabase, returnTo, "crear");
}

export async function cerrarSesion() {
  const supabase = await crearClienteSupabaseServidor();
  await supabase.auth.signOut();
  redirect("/");
}
