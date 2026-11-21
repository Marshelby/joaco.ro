import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";

import { crearClienteSupabaseServidor } from "@/lib/supabase/server";

// React comparte la comprobación entre layout y página durante la solicitud.
export const exigirSesionAdmin = cache(async () => {
  const supabase = await crearClienteSupabaseServidor({ sinCache: true });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/iniciar-sesion");
  const { data: perfil } = await supabase.from("perfiles").select("rol").eq("usuario_id", user.id).maybeSingle();
  if (perfil?.rol !== "admin") redirect("/");
  return supabase;
});
