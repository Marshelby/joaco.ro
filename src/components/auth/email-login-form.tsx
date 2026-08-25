"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";

import { type EstadoInicioSesion } from "@/app/iniciar-sesion/actions";
import { TurnstileCaptcha } from "@/components/auth/turnstile-captcha";
import { hrefConReturnTo } from "@/lib/account/return-to";
import { RECOVERY_EMAIL_PREFILL_STORAGE_KEY } from "@/lib/auth/password-recovery";

export type MetodoAutenticacionActivo = "email" | "google" | null;

type EmailLoginFormProps = {
  modo: "iniciar" | "crear";
  returnTo: string | null;
  action: ((estadoAnterior: EstadoInicioSesion, formData: FormData) => Promise<EstadoInicioSesion>) | ((formData: FormData) => void | Promise<void>);
  metodoAutenticacionActivo?: MetodoAutenticacionActivo;
  onMetodoAutenticacionChange?: (metodo: MetodoAutenticacionActivo) => void;
};

const estadoInicioSesionInicial: EstadoInicioSesion = {};

export function EmailLoginForm(props: EmailLoginFormProps) {
  if (props.modo === "iniciar") {
    return <PasswordLoginForm action={props.action as (estadoAnterior: EstadoInicioSesion, formData: FormData) => Promise<EstadoInicioSesion>} returnTo={props.returnTo} metodoAutenticacionActivo={props.metodoAutenticacionActivo ?? null} onMetodoAutenticacionChange={props.onMetodoAutenticacionChange} />;
  }

  return <SignupForm action={props.action as (formData: FormData) => void | Promise<void>} returnTo={props.returnTo} />;
}

function PasswordLoginForm({
  action,
  returnTo,
  metodoAutenticacionActivo,
  onMetodoAutenticacionChange,
}: {
  action: (estadoAnterior: EstadoInicioSesion, formData: FormData) => Promise<EstadoInicioSesion>;
  returnTo: string | null;
  metodoAutenticacionActivo: MetodoAutenticacionActivo;
  onMetodoAutenticacionChange?: (metodo: MetodoAutenticacionActivo) => void;
}) {
  const [estado, accion, pendiente] = useActionState(action, estadoInicioSesionInicial);
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaReset, setCaptchaReset] = useState(0);
  const passwordRef = useRef<HTMLInputElement>(null);
  const hayError = Boolean(estado.error);
  const bloqueadoPorGoogle = metodoAutenticacionActivo === "google";

  useEffect(() => {
    if (!estado.error) return;
    if (passwordRef.current) passwordRef.current.value = "";
    if (estado.error === "credenciales") passwordRef.current?.focus();
    onMetodoAutenticacionChange?.(null);
    const temporizador = window.setTimeout(() => {
      setEmail(estado.email ?? "");
      setCaptchaReset((valor) => valor + 1);
    }, 0);
    return () => window.clearTimeout(temporizador);
  }, [estado, onMetodoAutenticacionChange]);

  const mensajeError = estado.error === "credenciales"
    ? "Correo o contraseña incorrectos."
    : estado.error === "demasiados_intentos"
      ? "Has realizado demasiados intentos. Espera un momento antes de volver a intentarlo."
      : estado.error === "verificacion"
        ? "No pudimos verificar el acceso. Intenta nuevamente."
      : estado.error === "tecnico"
        ? "No pudimos iniciar sesión en este momento. Intenta nuevamente."
        : null;

  function irARecuperarContrasena() {
    try {
      const correo = email.trim().toLowerCase();
      if (correo) sessionStorage.setItem(RECOVERY_EMAIL_PREFILL_STORAGE_KEY, correo);
      else sessionStorage.removeItem(RECOVERY_EMAIL_PREFILL_STORAGE_KEY);
    } catch {
      // La recuperación sigue disponible aunque el navegador bloquee sessionStorage.
    }
    router.push(hrefConReturnTo("/recuperar-contrasena", returnTo));
  }

  return (
    <form action={accion} onSubmit={() => onMetodoAutenticacionChange?.("email")} className="space-y-4">
      <input name="returnTo" type="hidden" value={returnTo ?? ""} />
      {process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ? <><input name="captchaToken" type="hidden" value={captchaToken} /><TurnstileCaptcha onTokenChange={setCaptchaToken} resetSignal={captchaReset} /></> : null}
      {mensajeError ? <p id="error-inicio-sesion" role="alert" className="text-sm text-destructive">{mensajeError}</p> : null}
      <label className="block text-sm font-medium">Correo<input required disabled={pendiente || bloqueadoPorGoogle} name="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-input bg-background px-3 disabled:cursor-not-allowed disabled:opacity-60" /></label>
      <label className="block text-sm font-medium">Contraseña<input ref={passwordRef} required disabled={pendiente || bloqueadoPorGoogle} name="password" type="password" autoComplete="current-password" aria-describedby={hayError ? "error-inicio-sesion" : undefined} className="mt-2 h-11 w-full rounded-lg border border-input bg-background px-3 disabled:cursor-not-allowed disabled:opacity-60" /></label>
      <button type="button" onClick={irARecuperarContrasena} disabled={pendiente || bloqueadoPorGoogle} className="text-left text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60">¿Olvidaste tu contraseña?</button>
      <button disabled={pendiente || bloqueadoPorGoogle || (Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) && !captchaToken)} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-input px-4 font-semibold disabled:cursor-not-allowed disabled:opacity-60" type="submit">
        {pendiente ? <><LoaderCircle className="size-4 animate-spin" aria-hidden="true" />Iniciando sesión…</> : "Iniciar sesión"}
      </button>
    </form>
  );
}

function SignupForm({ action, returnTo }: { action: (formData: FormData) => void | Promise<void>; returnTo: string | null }) {
  const [captchaToken, setCaptchaToken] = useState("");
  const captchaHabilitado = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);
  return (
    <form action={action} className="space-y-4">
      <input name="returnTo" type="hidden" value={returnTo ?? ""} />
      {captchaHabilitado ? <><input name="captchaToken" type="hidden" value={captchaToken} /><TurnstileCaptcha onTokenChange={setCaptchaToken} /></> : null}
      <EmailLoginFields modo="crear" captchaPendiente={captchaHabilitado && !captchaToken} />
    </form>
  );
}

function EmailLoginFields({ modo, captchaPendiente = false }: Pick<EmailLoginFormProps, "modo"> & { captchaPendiente?: boolean }) {
  const { pending } = useFormStatus();
  const creando = modo === "crear";

  return (
    <>
      {creando ? <label className="block text-sm font-medium">Nombre<input required disabled={pending} name="nombre" autoComplete="name" className="mt-2 h-11 w-full rounded-lg border border-input bg-background px-3 disabled:cursor-not-allowed disabled:opacity-60" /></label> : null}
      <label className="block text-sm font-medium">Correo<input required disabled={pending} name="email" type="email" autoComplete="email" className="mt-2 h-11 w-full rounded-lg border border-input bg-background px-3 disabled:cursor-not-allowed disabled:opacity-60" /></label>
      <label className="block text-sm font-medium">Contraseña<input required disabled={pending} name="password" type="password" autoComplete={creando ? "new-password" : "current-password"} minLength={creando ? 8 : undefined} className="mt-2 h-11 w-full rounded-lg border border-input bg-background px-3 disabled:cursor-not-allowed disabled:opacity-60" /></label>
      {creando ? <label className="block text-sm font-medium">Confirmar contraseña<input required disabled={pending} name="confirmarPassword" type="password" autoComplete="new-password" minLength={8} className="mt-2 h-11 w-full rounded-lg border border-input bg-background px-3 disabled:cursor-not-allowed disabled:opacity-60" /></label> : null}
      <button disabled={pending || captchaPendiente} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-input px-4 font-semibold disabled:cursor-not-allowed disabled:opacity-60" type="submit">
        {pending ? <><LoaderCircle className="size-4 animate-spin" aria-hidden="true" />{creando ? "Creando cuenta…" : "Iniciando sesión…"}</> : creando ? "Crear cuenta" : "Iniciar sesión"}
      </button>
    </>
  );
}
