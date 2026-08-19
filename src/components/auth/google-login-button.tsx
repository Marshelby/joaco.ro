"use client";
import { useState } from "react";
import { crearClienteSupabaseNavegador } from "@/lib/supabase/client";
export function GoogleLoginButton({ returnTo }: { returnTo: string | null }) {
  const [cargando, setCargando] = useState(false); const [error, setError] = useState(false);
  async function ingresar() { setCargando(true); setError(false); const supabase = crearClienteSupabaseNavegador(); const callback = new URL("/auth/callback", window.location.origin); if (returnTo) callback.searchParams.set("returnTo", returnTo); const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: callback.toString() } }); if (error) { setError(true); setCargando(false); } }
  return <><button type="button" disabled={cargando} onClick={ingresar} className="h-11 w-full rounded-lg bg-primary px-4 font-semibold text-primary-foreground">{cargando ? "Redirigiendo..." : "Continuar con Google"}</button>{error ? <p className="text-sm text-destructive">No fue posible iniciar Google. Intenta nuevamente.</p> : null}</>;
}
