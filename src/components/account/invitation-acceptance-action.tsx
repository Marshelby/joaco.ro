"use client";

import { LoaderCircle } from "lucide-react";
import { useActionState } from "react";

import { aceptarInvitacionCliente } from "@/app/(public)/aceptar-invitacion/actions";
import { ActionLink } from "@/components/ui/action-link";
import { ROUTES } from "@/config/routes";

export function InvitationAcceptanceAction({ token }: { token: string }) {
  const [estado, accion, pendiente] = useActionState(aceptarInvitacionCliente, {});
  if (estado.exito) return <div className="space-y-4" role="status"><p className="text-sm leading-6 text-primary">{estado.exito}</p><ActionLink href={ROUTES.account}>Ir a Mi cuenta</ActionLink></div>;
  return <form action={accion} className="space-y-4"><input type="hidden" name="token" value={token} /><button type="submit" disabled={pendiente} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60">{pendiente ? <><LoaderCircle className="size-4 animate-spin" aria-hidden="true" />Verificando…</> : "Vincular mi cuenta"}</button>{estado.error ? <p role="alert" className="text-sm leading-6 text-destructive">{estado.error}</p> : null}</form>;
}
