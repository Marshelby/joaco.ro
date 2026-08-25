"use client";

import { useActionState, useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";

import { enviarEnlaceRecuperacion, type EstadoRecuperacionContrasena } from "@/app/(public)/recuperar-contrasena/actions";
import { TurnstileCaptcha } from "@/components/auth/turnstile-captcha";
import { RECOVERY_EMAIL_PREFILL_STORAGE_KEY } from "@/lib/auth/password-recovery";

const estadoInicial: EstadoRecuperacionContrasena = {};

export function PasswordRecoveryForm({ returnTo }: { returnTo: string | null }) {
  const [estado, accion, pendiente] = useActionState(enviarEnlaceRecuperacion, estadoInicial);
  const [email, setEmail] = useState(() => {
    try {
      const correo = sessionStorage.getItem(RECOVERY_EMAIL_PREFILL_STORAGE_KEY) ?? "";
      sessionStorage.removeItem(RECOVERY_EMAIL_PREFILL_STORAGE_KEY);
      return correo;
    } catch {
      return "";
    }
  });
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaReset, setCaptchaReset] = useState(0);
  const captchaHabilitado = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);

  useEffect(() => {
    if (!estado.error) return;
    const temporizador = window.setTimeout(() => {
      setEmail(estado.email ?? "");
      setCaptchaReset((valor) => valor + 1);
    }, 0);
    return () => window.clearTimeout(temporizador);
  }, [estado]);

  const mensajeError = estado.error === "correo"
    ? "Ingresa un correo válido."
    : estado.error === "demasiados_intentos"
      ? "Has solicitado varios enlaces. Espera un momento antes de intentarlo nuevamente."
      : estado.error === "verificacion"
        ? "No pudimos verificar la solicitud. Intenta nuevamente."
        : estado.error === "tecnico"
          ? "No pudimos procesar la solicitud en este momento. Intenta nuevamente."
          : null;

  return (
    <form action={accion} className="space-y-4">
      <input name="returnTo" type="hidden" value={returnTo ?? ""} />
      {captchaHabilitado ? <><input name="captchaToken" type="hidden" value={captchaToken} /><TurnstileCaptcha onTokenChange={setCaptchaToken} resetSignal={captchaReset} /></> : null}
      {mensajeError ? <p id="error-recuperacion" role="alert" className="text-sm text-destructive">{mensajeError}</p> : null}
      <label className="block text-sm font-medium">Correo<input required disabled={pendiente} name="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} aria-describedby={mensajeError ? "error-recuperacion" : undefined} className="mt-2 h-11 w-full rounded-lg border border-input bg-background px-3 disabled:cursor-not-allowed disabled:opacity-60" /></label>
      <button disabled={pendiente || (captchaHabilitado && !captchaToken)} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-input px-4 font-semibold disabled:cursor-not-allowed disabled:opacity-60" type="submit">
        {pendiente ? <><LoaderCircle className="size-4 animate-spin" aria-hidden="true" />Enviando enlace…</> : "Enviar enlace de recuperación"}
      </button>
    </form>
  );
}
