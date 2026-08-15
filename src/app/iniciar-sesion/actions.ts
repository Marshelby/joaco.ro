"use server";

import { redirect } from "next/navigation";
import { crearClienteSupabaseServidor } from "@/lib/supabase/server";

export async function iniciarSesion(datos: FormData) {
  const supabase = await crearClienteSupabaseServidor();
  const { error } = await supabase.auth.signInWithPassword({ email: String(datos.get("email") ?? ""), password: String(datos.get("password") ?? "") });
  if (error) redirect("/iniciar-sesion?error=credenciales");
  redirect("/admin");
}

export async function cerrarSesion() {
  const supabase = await crearClienteSupabaseServidor();
  await supabase.auth.signOut();
  redirect("/");
}
