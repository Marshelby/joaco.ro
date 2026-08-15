"use client";

import { LogOut, LoaderCircle } from "lucide-react";
import { useFormStatus } from "react-dom";

import { cerrarSesion } from "@/app/iniciar-sesion/actions";
import { cn } from "@/lib/utils";

type SignOutButtonProps = {
  className?: string;
};

export function SignOutButton({ className }: SignOutButtonProps) {
  return <form action={cerrarSesion} className="max-w-full"><SubmitButton className={className} /></form>;
}

function SubmitButton({ className }: SignOutButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" disabled={pending} className={cn("box-border inline-flex min-h-11 max-w-full items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60", className)}>
      {pending ? <><LoaderCircle className="size-4 shrink-0 animate-spin" aria-hidden="true" />Cerrando sesión…</> : <><LogOut className="size-4 shrink-0" aria-hidden="true" />Cerrar sesión</>}
    </button>
  );
}
