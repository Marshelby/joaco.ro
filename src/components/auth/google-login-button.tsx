"use client";
import { useState } from "react";
import { crearClienteSupabaseNavegador } from "@/lib/supabase/client";
export function GoogleLoginButton({ returnTo, disabled = false, onAuthenticationStart, onAuthenticationEnd }: { returnTo: string | null; disabled?: boolean; onAuthenticationStart?: () => void; onAuthenticationEnd?: () => void }) {
  const [cargando, setCargando] = useState(false); const [error, setError] = useState(false);
  async function ingresar() { if (disabled || cargando) return; onAuthenticationStart?.(); setCargando(true); setError(false); try { const supabase = crearClienteSupabaseNavegador(); const callback = new URL("/auth/callback", window.location.origin); if (returnTo) callback.searchParams.set("returnTo", returnTo); const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: callback.toString() } }); if (error) { setError(true); setCargando(false); onAuthenticationEnd?.(); } } catch { setError(true); setCargando(false); onAuthenticationEnd?.(); } }
  return <><button type="button" disabled={disabled || cargando} onClick={ingresar} className="h-11 w-full rounded-lg bg-primary px-4 font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60">{cargando ? "Redirigiendo..." : "Continuar con Google"}</button>{error ? <p className="text-sm text-destructive">No fue posible iniciar Google. Intenta nuevamente.</p> : null}</>;
}
