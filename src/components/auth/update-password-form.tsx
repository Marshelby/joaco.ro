"use client";

import { useActionState, useEffect, useRef } from "react";
import { LoaderCircle } from "lucide-react";

import { actualizarContrasena, type EstadoActualizarContrasena } from "@/app/(public)/actualizar-contrasena/actions";
import { ActionLink } from "@/components/ui/action-link";
import { hrefConReturnTo } from "@/lib/account/return-to";

const estadoInicial: EstadoActualizarContrasena = {};

export function UpdatePasswordForm({ returnTo }: { returnTo: string | null }) {
  const [estado, accion, pendiente] = useActionState(actualizarContrasena, estadoInicial);
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmarPasswordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!estado.error) return;
    if (passwordRef.current) passwordRef.current.value = "";
    if (confirmarPasswordRef.current) confirmarPasswordRef.current.value = "";
    passwordRef.current?.focus();
  }, [estado]);

  if (estado.exito) {
    return (
      <div className="space-y-5" aria-live="polite">
        <p className="text-sm leading-6 text-foreground">Tu contraseña fue actualizada correctamente.</p>
        <ActionLink href={hrefConReturnTo("/iniciar-sesion", returnTo)} variant="primary">Continuar</ActionLink>
      </div>
    );
  }

  const mensajeError = estado.error === "coincidencia"
    ? "Las contraseñas no coinciden."
    : estado.error === "debil"
      ? "Elige una contraseña de al menos 8 caracteres que cumpla la política de seguridad."
      : estado.error === "enlace_invalido"
        ? "El enlace de recuperación ya no es válido o expiró."
        : estado.error === "tecnico"
          ? "No pudimos actualizar tu contraseña en este momento. Intenta nuevamente."
          : null;

  return (
    <form action={accion} className="space-y-4">
      {mensajeError ? <p id="error-actualizar-contrasena" role="alert" className="text-sm text-destructive">{mensajeError}</p> : null}
      <label className="block text-sm font-medium">Nueva contraseña<input ref={passwordRef} required disabled={pendiente} name="password" type="password" autoComplete="new-password" minLength={8} aria-describedby={mensajeError ? "error-actualizar-contrasena" : undefined} className="mt-2 h-11 w-full rounded-lg border border-input bg-background px-3 disabled:cursor-not-allowed disabled:opacity-60" /></label>
      <label className="block text-sm font-medium">Confirmar contraseña<input ref={confirmarPasswordRef} required disabled={pendiente} name="confirmarPassword" type="password" autoComplete="new-password" minLength={8} aria-describedby={mensajeError ? "error-actualizar-contrasena" : undefined} className="mt-2 h-11 w-full rounded-lg border border-input bg-background px-3 disabled:cursor-not-allowed disabled:opacity-60" /></label>
      <button disabled={pendiente} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-input px-4 font-semibold disabled:cursor-not-allowed disabled:opacity-60" type="submit">
        {pendiente ? <><LoaderCircle className="size-4 animate-spin" aria-hidden="true" />Actualizando contraseña…</> : "Actualizar contraseña"}
      </button>
    </form>
  );
}
