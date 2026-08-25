"use client";

import { useFormStatus } from "react-dom";
import { LoaderCircle } from "lucide-react";

import { confirmarEnlaceRecuperacion } from "@/app/(public)/confirmar-recuperacion/actions";

export function RecoveryLinkConfirmationForm({ tokenHash, returnTo }: { tokenHash: string; returnTo: string | null }) {
  return (
    <form action={confirmarEnlaceRecuperacion}>
      <input name="tokenHash" type="hidden" value={tokenHash} />
      <input name="returnTo" type="hidden" value={returnTo ?? ""} />
      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground outline-none transition-colors hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60" type="submit">
      {pending ? <><LoaderCircle className="size-4 animate-spin" aria-hidden="true" />Verificando enlace…</> : "Continuar para crear una nueva contraseña"}
    </button>
  );
}
