"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { LoaderCircle } from "lucide-react";

import { actualizarContrasena, type EstadoActualizarContrasena } from "@/app/(public)/actualizar-contrasena/actions";
const estadoInicial: EstadoActualizarContrasena = {};

export function UpdatePasswordForm({ returnTo }: { returnTo: string | null }) {
  const [estado, accion, pendiente] = useActionState(actualizarContrasena, estadoInicial);
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmarPasswordRef = useRef<HTMLInputElement>(null);
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [mostrarConfirmacion, setMostrarConfirmacion] = useState(false);

  useEffect(() => {
    if (!estado.error) return;
    if (passwordRef.current) passwordRef.current.value = "";
    if (confirmarPasswordRef.current) confirmarPasswordRef.current.value = "";
    passwordRef.current?.focus();
  }, [estado]);

  const mensajeError = estado.error === "coincidencia"
    ? "Las contraseñas no coinciden."
    : estado.error === "debil"
      ? "Elige una contraseña de al menos 8 caracteres que cumpla la política de seguridad."
      : estado.error === "demasiados_intentos"
        ? "Has realizado demasiados intentos. Espera un momento antes de volver a intentarlo."
      : estado.error === "enlace_invalido"
        ? "El enlace de recuperación ya no es válido o expiró."
        : estado.error === "tecnico"
          ? "No pudimos actualizar tu contraseña en este momento. Intenta nuevamente."
          : null;

  return (
    <form action={accion} className="space-y-4">
      <input name="returnTo" type="hidden" value={returnTo ?? ""} />
      {mensajeError ? <p id="error-actualizar-contrasena" role="alert" className="text-sm text-destructive">{mensajeError}</p> : null}
      <label className="block text-sm font-medium">Nueva contraseña<span className="relative mt-2 block"><input ref={passwordRef} required disabled={pendiente} name="password" type={mostrarPassword ? "text" : "password"} autoComplete="new-password" minLength={8} aria-describedby={mensajeError ? "error-actualizar-contrasena" : undefined} className="h-11 w-full rounded-lg border border-input bg-background py-2 pl-3 pr-20 disabled:cursor-not-allowed disabled:opacity-60" /><button type="button" disabled={pendiente} onClick={() => setMostrarPassword((visible) => !visible)} aria-label={mostrarPassword ? "Ocultar nueva contraseña" : "Mostrar nueva contraseña"} aria-pressed={mostrarPassword} className="absolute inset-y-0 right-0 px-3 text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60">{mostrarPassword ? "Ocultar" : "Mostrar"}</button></span></label>
      <label className="block text-sm font-medium">Confirmar contraseña<span className="relative mt-2 block"><input ref={confirmarPasswordRef} required disabled={pendiente} name="confirmarPassword" type={mostrarConfirmacion ? "text" : "password"} autoComplete="new-password" minLength={8} aria-describedby={mensajeError ? "error-actualizar-contrasena" : undefined} className="h-11 w-full rounded-lg border border-input bg-background py-2 pl-3 pr-20 disabled:cursor-not-allowed disabled:opacity-60" /><button type="button" disabled={pendiente} onClick={() => setMostrarConfirmacion((visible) => !visible)} aria-label={mostrarConfirmacion ? "Ocultar confirmación de contraseña" : "Mostrar confirmación de contraseña"} aria-pressed={mostrarConfirmacion} className="absolute inset-y-0 right-0 px-3 text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60">{mostrarConfirmacion ? "Ocultar" : "Mostrar"}</button></span></label>
      <button disabled={pendiente} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-input px-4 font-semibold disabled:cursor-not-allowed disabled:opacity-60" type="submit">
        {pendiente ? <><LoaderCircle className="size-4 animate-spin" aria-hidden="true" />Actualizando contraseña…</> : "Actualizar contraseña"}
      </button>
    </form>
  );
}
