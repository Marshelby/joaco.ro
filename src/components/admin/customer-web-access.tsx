"use client";

import { Copy, KeyRound, LoaderCircle } from "lucide-react";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import {
  crearInvitacionAccesoCliente,
  revocarInvitacionAccesoCliente,
  type EstadoInvitacionAcceso,
} from "@/app/(admin)/admin/clientes/actions";
import type { InvitacionAccesoClienteAdmin } from "@/lib/admin/clientes";

type CustomerWebAccessProps = {
  clienteId: string;
  clienteActivo: boolean;
  usuarioId: string | null;
  invitacion: InvitacionAccesoClienteAdmin | null;
};

export function CustomerWebAccess({ clienteId, clienteActivo, usuarioId, invitacion }: CustomerWebAccessProps) {
  const [estadoCrear, accionCrear] = useActionState(crearInvitacionAccesoCliente, {});
  const [estadoRevocar, accionRevocar] = useActionState(revocarInvitacionAccesoCliente, {});
  const [copiado, setCopiado] = useState(false);
  const pendiente = invitacion?.estado === "pendiente";

  async function copiarEnlace() {
    if (!estadoCrear.enlace) return;
    try {
      await navigator.clipboard.writeText(estadoCrear.enlace);
      setCopiado(true);
    } catch {
      setCopiado(false);
    }
  }

  return <section className="rounded-xl border border-border bg-card p-5 sm:p-6" aria-labelledby="acceso-web-title"><div className="flex gap-3"><KeyRound className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" /><div><h2 id="acceso-web-title" className="text-lg font-semibold tracking-tight text-foreground">Acceso web</h2>{usuarioId ? <p className="mt-1 text-sm leading-6 text-muted-foreground">Acceso web activo para este cliente.</p> : !clienteActivo ? <p className="mt-1 text-sm leading-6 text-muted-foreground">No se puede habilitar acceso web para un cliente inactivo.</p> : pendiente ? <p className="mt-1 text-sm leading-6 text-muted-foreground">Invitación pendiente para {invitacion.correoDestino}. Expira el {new Date(invitacion.fechaExpiracion).toLocaleDateString("es-CL")}.</p> : <p className="mt-1 text-sm leading-6 text-muted-foreground">Este cliente no tiene acceso web.</p>}</div></div>{!usuarioId && clienteActivo && !pendiente ? <form action={accionCrear} className="mt-5 space-y-3"><input type="hidden" name="clienteId" value={clienteId} /><label className="block text-sm font-medium text-foreground">Correo de la persona autorizada<input required name="correoDestino" type="email" autoComplete="email" className="mt-2 h-11 w-full rounded-lg border border-input bg-background px-3 text-sm" /></label><InvitationSubmitButton>{"Dar acceso web"}</InvitationSubmitButton>{estadoCrear.error ? <p role="alert" className="text-sm text-destructive">{estadoCrear.error}</p> : null}{estadoCrear.exito ? <p role="status" className="text-sm text-primary">{estadoCrear.exito}</p> : null}{estadoCrear.enlace ? <div className="rounded-lg border border-border bg-muted/40 p-3"><p className="break-all text-sm text-foreground">{estadoCrear.enlace}</p><button type="button" onClick={copiarEnlace} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm font-semibold text-foreground"> <Copy className="size-4" aria-hidden="true" />{copiado ? "Enlace copiado" : "Copiar enlace"}</button></div> : null}</form> : null}{!usuarioId && clienteActivo && pendiente ? <form action={accionRevocar} className="mt-5"><input type="hidden" name="clienteId" value={clienteId} /><input type="hidden" name="invitacionId" value={invitacion.id} /><InvitationSubmitButton variant="secondary">Revocar invitación</InvitationSubmitButton>{estadoRevocar.error ? <p role="alert" className="mt-3 text-sm text-destructive">{estadoRevocar.error}</p> : null}{estadoRevocar.exito ? <p role="status" className="mt-3 text-sm text-primary">{estadoRevocar.exito}</p> : null}</form> : null}</section>;
}

function InvitationSubmitButton({ children, variant = "primary" }: { children: string; variant?: "primary" | "secondary" }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60 ${variant === "primary" ? "bg-primary text-primary-foreground" : "border border-border bg-background text-foreground"}`}>{pending ? <><LoaderCircle className="size-4 animate-spin" aria-hidden="true" />Guardando…</> : children}</button>;
}
