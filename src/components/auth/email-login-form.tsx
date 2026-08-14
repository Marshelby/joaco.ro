"use client";

import { LoaderCircle } from "lucide-react";
import { useFormStatus } from "react-dom";

type EmailLoginFormProps = {
  action: (formData: FormData) => void | Promise<void>;
};

export function EmailLoginForm({ action }: EmailLoginFormProps) {
  return (
    <form action={action} className="space-y-4">
      <EmailLoginFields />
    </form>
  );
}

function EmailLoginFields() {
  const { pending } = useFormStatus();

  return (
    <>
      <label className="block text-sm font-medium">Correo<input required disabled={pending} name="email" type="email" className="mt-2 h-11 w-full rounded-lg border border-input bg-background px-3 disabled:cursor-not-allowed disabled:opacity-60" /></label>
      <label className="block text-sm font-medium">Contraseña<input required disabled={pending} name="password" type="password" className="mt-2 h-11 w-full rounded-lg border border-input bg-background px-3 disabled:cursor-not-allowed disabled:opacity-60" /></label>
      <button disabled={pending} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-input px-4 font-semibold disabled:cursor-not-allowed disabled:opacity-60" type="submit">
        {pending ? <><LoaderCircle className="size-4 animate-spin" aria-hidden="true" />Iniciando sesión…</> : "Entrar con correo"}
      </button>
    </>
  );
}
