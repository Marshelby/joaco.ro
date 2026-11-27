"use client";

import { formatDateCL } from "@/lib/formatters";
import { Dialog } from "@base-ui/react/dialog";
import { Copy, KeyRound, LoaderCircle, X } from "lucide-react";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import {
  crearInvitacionAccesoCliente,
  revocarInvitacionAccesoCliente,
  type EstadoInvitacionAcceso,
} from "@/app/(admin)/admin/clientes/actions";
import { buttonVariants } from "@/components/ui/button";
import type { InvitacionAccesoClienteAdmin } from "@/lib/admin/clientes";

type CustomerWebAccessProps = {
  compact?: boolean;
  modal?: boolean;
  readOnly?: boolean;
  clienteId: string;
  clienteActivo: boolean;
  usuarioId: string | null;
  invitacion: InvitacionAccesoClienteAdmin | null;
};

export function CustomerWebAccess({ clienteId, clienteActivo, usuarioId, invitacion, readOnly = false, compact = false, modal = false }: CustomerWebAccessProps) {
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

  const contenido = <section className={`min-w-0 rounded-xl border border-border bg-card wrap-anywhere ${modal ? "border-0" : compact ? "grid items-start gap-2 p-3 @3xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]" : "p-5 sm:p-6"}`} aria-labelledby="acceso-web-title"><div className={modal ? "flex gap-3 pr-8" : "flex gap-3"}><KeyRound className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" /><div>{modal ? <Dialog.Title id="acceso-web-title" className="text-lg font-semibold tracking-tight text-foreground">Acceso web</Dialog.Title> : <h2 id="acceso-web-title" className="text-lg font-semibold tracking-tight text-foreground">Acceso web</h2>}{usuarioId ? <p className="mt-1 text-sm leading-6 text-muted-foreground">Acceso web activo para este cliente.</p> : !clienteActivo ? <p className="mt-1 text-sm leading-6 text-muted-foreground">No se puede habilitar acceso web para un cliente inactivo.</p> : pendiente ? <p className="mt-1 text-sm leading-6 text-muted-foreground">Invitación pendiente para {invitacion.correoDestino}. Expira el {formatDateCL(invitacion.fechaExpiracion)}.</p> : <p className="mt-1 text-sm leading-6 text-muted-foreground">Este cliente no tiene acceso web.</p>}</div></div>{!readOnly && !usuarioId && clienteActivo && !pendiente ? <form action={accionCrear} className={compact ? "grid items-end gap-2 @xl:grid-cols-[minmax(0,1fr)_auto] [&>p]:col-span-full [&>div]:col-span-full" : "mt-5 space-y-3"}><input type="hidden" name="clienteId" value={clienteId} /><label className="block text-sm font-medium text-foreground">Correo de la persona autorizada<input required name="correoDestino" type="email" autoComplete="email" className="mt-2 h-11 w-full rounded-lg border border-input bg-background px-3 text-sm" /></label><InvitationSubmitButton>{"Dar acceso web"}</InvitationSubmitButton>{estadoCrear.error ? <p role="alert" className="text-sm text-destructive">{estadoCrear.error}</p> : null}{estadoCrear.exito ? <p role="status" className="text-sm text-primary">{estadoCrear.exito}</p> : null}{estadoCrear.enlace ? <div className="rounded-lg border border-border bg-muted/40 p-3"><p className="break-all text-sm text-foreground">{estadoCrear.enlace}</p><button type="button" onClick={copiarEnlace} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm font-semibold text-foreground"> <Copy className="size-4" aria-hidden="true" />{copiado ? "Enlace copiado" : "Copiar enlace"}</button></div> : null}</form> : null}{!readOnly && !usuarioId && clienteActivo && pendiente ? <form action={accionRevocar} className={compact ? "@3xl:justify-self-end" : "mt-5"}><input type="hidden" name="clienteId" value={clienteId} /><input type="hidden" name="invitacionId" value={invitacion.id} /><InvitationSubmitButton variant="secondary">Revocar invitación</InvitationSubmitButton>{estadoRevocar.error ? <p role="alert" className="mt-3 text-sm text-destructive">{estadoRevocar.error}</p> : null}{estadoRevocar.exito ? <p role="status" className="mt-3 text-sm text-primary">{estadoRevocar.exito}</p> : null}</form> : null}</section>;
  if (!modal) return contenido;

  return (
    <Dialog.Root>
      <Dialog.Trigger type="button" className={buttonVariants({ variant: "outline", size: "sm", className: "h-9 px-3 text-sm" })}>
        <KeyRound aria-hidden="true" />
        Acceso web
      </Dialog.Trigger>
      <Dialog.Portal keepMounted>
        <Dialog.Backdrop className="motion-dialog-backdrop fixed inset-0 z-50 bg-foreground/25" />
        <Dialog.Viewport className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <Dialog.Popup className="motion-dialog-content relative max-h-[85dvh] w-full max-w-lg overflow-y-auto rounded-2xl border bg-card p-4 shadow-xl outline-none sm:p-5">
            <Dialog.Close type="button" aria-label="Cerrar acceso web" className={buttonVariants({ variant: "ghost", size: "icon-lg", className: "absolute right-2 top-2" })}>
              <X aria-hidden="true" />
            </Dialog.Close>
            {contenido}
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function InvitationSubmitButton({ children, variant = "primary" }: { children: string; variant?: "primary" | "secondary" }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60 ${variant === "primary" ? "bg-primary text-primary-foreground" : "border border-border bg-background text-foreground"}`}>{pending ? <><LoaderCircle className="size-4 animate-spin" aria-hidden="true" />Guardando…</> : children}</button>;
}
