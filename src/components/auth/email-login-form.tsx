"use client";

import { LoaderCircle } from "lucide-react";
import { useFormStatus } from "react-dom";

type EmailLoginFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  modo: "iniciar" | "crear";
  returnTo: string | null;
};

export function EmailLoginForm({ action, modo, returnTo }: EmailLoginFormProps) {
  return (
    <form action={action} className="space-y-4">
      <input name="returnTo" type="hidden" value={returnTo ?? ""} />
      <EmailLoginFields modo={modo} />
    </form>
  );
}

function EmailLoginFields({ modo }: Pick<EmailLoginFormProps, "modo">) {
  const { pending } = useFormStatus();
  const creando = modo === "crear";

  return (
    <>
      {creando ? <label className="block text-sm font-medium">Nombre<input required disabled={pending} name="nombre" autoComplete="name" className="mt-2 h-11 w-full rounded-lg border border-input bg-background px-3 disabled:cursor-not-allowed disabled:opacity-60" /></label> : null}
      <label className="block text-sm font-medium">Correo<input required disabled={pending} name="email" type="email" autoComplete="email" className="mt-2 h-11 w-full rounded-lg border border-input bg-background px-3 disabled:cursor-not-allowed disabled:opacity-60" /></label>
      <label className="block text-sm font-medium">Contraseña<input required disabled={pending} name="password" type="password" autoComplete={creando ? "new-password" : "current-password"} minLength={creando ? 8 : undefined} className="mt-2 h-11 w-full rounded-lg border border-input bg-background px-3 disabled:cursor-not-allowed disabled:opacity-60" /></label>
      {creando ? <label className="block text-sm font-medium">Confirmar contraseña<input required disabled={pending} name="confirmarPassword" type="password" autoComplete="new-password" minLength={8} className="mt-2 h-11 w-full rounded-lg border border-input bg-background px-3 disabled:cursor-not-allowed disabled:opacity-60" /></label> : null}
      <button disabled={pending} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-input px-4 font-semibold disabled:cursor-not-allowed disabled:opacity-60" type="submit">
        {pending ? <><LoaderCircle className="size-4 animate-spin" aria-hidden="true" />{creando ? "Creando cuenta…" : "Iniciando sesión…"}</> : creando ? "Crear cuenta" : "Iniciar sesión"}
      </button>
    </>
  );
}
