"use server";

import { crearClienteSupabaseServidor } from "@/lib/supabase/server";

export type EstadoActualizarContrasena = {
  error?: "enlace_invalido" | "coincidencia" | "debil" | "tecnico";
  exito?: boolean;
};

const longitudMinima = 8;

export async function actualizarContrasena(
  _estadoAnterior: EstadoActualizarContrasena,
  datos: FormData,
): Promise<EstadoActualizarContrasena> {
  const password = String(datos.get("password") ?? "");
  const confirmarPassword = String(datos.get("confirmarPassword") ?? "");

  if (!password || password.length < longitudMinima) return { error: "debil" };
  if (password !== confirmarPassword) return { error: "coincidencia" };

  try {
    const supabase = await crearClienteSupabaseServidor();
    const { data: { user }, error: errorUsuario } = await supabase.auth.getUser();
    if (errorUsuario || !user) return { error: "enlace_invalido" };

    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      if (error.code === "weak_password" || error.code === "same_password") return { error: "debil" };
      return { error: "tecnico" };
    }

    await supabase.auth.signOut();
    return { exito: true };
  } catch {
    return { error: "tecnico" };
  }
}
