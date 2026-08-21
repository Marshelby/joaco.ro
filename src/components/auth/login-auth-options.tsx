"use client";

import { useState } from "react";

import { crearCuenta, iniciarSesion } from "@/app/iniciar-sesion/actions";
import { EmailLoginForm, type MetodoAutenticacionActivo } from "@/components/auth/email-login-form";
import { GoogleLoginButton } from "@/components/auth/google-login-button";

export function LoginAuthOptions({ modo, returnTo }: { modo: "iniciar" | "crear"; returnTo: string | null }) {
  const [metodoAutenticacionActivo, setMetodoAutenticacionActivo] = useState<MetodoAutenticacionActivo>(null);
  const coordinandoLoginPassword = modo === "iniciar";
  const loginEmailActivo = coordinandoLoginPassword && metodoAutenticacionActivo === "email";
  const loginGoogleActivo = coordinandoLoginPassword && metodoAutenticacionActivo === "google";

  return <><GoogleLoginButton returnTo={returnTo} disabled={loginEmailActivo} onAuthenticationStart={() => coordinandoLoginPassword && setMetodoAutenticacionActivo("google")} onAuthenticationEnd={() => setMetodoAutenticacionActivo(null)} /><div className="border-t pt-5"><p className="mb-3 text-sm text-muted-foreground">O continúa con correo</p><EmailLoginForm action={modo === "crear" ? crearCuenta : iniciarSesion} modo={modo} returnTo={returnTo} metodoAutenticacionActivo={loginGoogleActivo ? "google" : null} onMetodoAutenticacionChange={coordinandoLoginPassword ? setMetodoAutenticacionActivo : undefined} /></div></>;
}
