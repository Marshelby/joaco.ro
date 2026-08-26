"use client";

import { useActionState } from "react";

import { actualizarPerfilCliente } from "@/app/(customer)/mi-cuenta/actions";
import { PendingButton } from "@/components/ui/pending-button";

export function CustomerProfileForm({ nombre, telefono, email }: { nombre: string; telefono: string | null; email: string | null }) {
  const [estado, accion, pendiente] = useActionState(actualizarPerfilCliente, {});

  return (
    <form id="datos-de-contacto" action={accion} className="space-y-5 rounded-xl border border-border bg-card p-5 sm:p-6">
      <div><h2 className="text-lg font-semibold tracking-tight text-foreground">Datos de contacto</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">Mantén actualizados los datos para coordinar tus pedidos.</p></div>
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="sm:col-span-2 text-sm font-medium text-foreground">Nombre<input required name="nombre" defaultValue={nombre} className="mt-2 h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50" /></label>
        <label className="text-sm font-medium text-foreground">Teléfono<input name="telefono" type="tel" defaultValue={telefono ?? ""} className="mt-2 h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50" /></label>
        <div><p className="text-sm font-medium text-foreground">Correo de acceso/contacto</p><p className="mt-2 break-all text-sm text-muted-foreground">{email ?? "Sin correo registrado"}</p><p className="mt-1 text-xs text-muted-foreground">Este correo no se modifica desde esta sección.</p></div>
      </div>
      <div className="flex flex-wrap items-center gap-3"><PendingButton type="submit" pending={pendiente} pendingLabel="Guardando…">Guardar cambios</PendingButton>{estado.exito ? <p aria-live="polite" className="text-sm text-primary">{estado.exito}</p> : null}{estado.error ? <p aria-live="polite" className="text-sm text-destructive">{estado.error}</p> : null}</div>
    </form>
  );
}
