"use client";

import { useActionState } from "react";

import { guardarDireccionCliente } from "@/app/(customer)/mi-cuenta/actions";
import { Button } from "@/components/ui/button";

export type DireccionClienteFormulario = {
  id?: string;
  nombre: string | null;
  destinatario: string | null;
  telefonoContacto: string | null;
  direccion: string;
  comuna: string;
  region: string;
  referencia: string | null;
  esPrincipal: boolean;
};

const campo = "mt-2 h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

export function CustomerAddressForm({ direccion }: { direccion?: DireccionClienteFormulario }) {
  const [estado, accion, pendiente] = useActionState(guardarDireccionCliente, {});

  return (
    <form action={accion} className="space-y-5 rounded-xl border border-border bg-card p-5 sm:p-6">
      <input type="hidden" name="direccionId" value={direccion?.id ?? ""} />
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="text-sm font-medium text-foreground">Nombre o etiqueta<input name="nombre" defaultValue={direccion?.nombre ?? ""} placeholder="Casa, bodega, sucursal" className={campo} /></label>
        <label className="text-sm font-medium text-foreground">Destinatario<input name="destinatario" defaultValue={direccion?.destinatario ?? ""} className={campo} /></label>
        <label className="text-sm font-medium text-foreground">Teléfono de contacto<input name="telefonoContacto" type="tel" defaultValue={direccion?.telefonoContacto ?? ""} className={campo} /></label>
        <label className="text-sm font-medium text-foreground">Dirección<input required name="direccion" defaultValue={direccion?.direccion ?? ""} className={campo} /></label>
        <label className="text-sm font-medium text-foreground">Comuna<input required name="comuna" defaultValue={direccion?.comuna ?? ""} className={campo} /></label>
        <label className="text-sm font-medium text-foreground">Región<input required name="region" defaultValue={direccion?.region ?? ""} className={campo} /></label>
        <label className="sm:col-span-2 text-sm font-medium text-foreground">Referencia<textarea name="referencia" defaultValue={direccion?.referencia ?? ""} rows={3} className="mt-2 w-full rounded-lg border border-input bg-background p-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50" /></label>
      </div>
      <label className="flex min-h-11 items-center gap-2 text-sm font-medium text-foreground"><input name="esPrincipal" type="checkbox" defaultChecked={direccion?.esPrincipal ?? false} /> Usar como dirección principal</label>
      <div className="flex flex-wrap items-center gap-3"><Button type="submit" disabled={pendiente}>{pendiente ? "Guardando…" : "Guardar dirección"}</Button>{estado.exito ? <p aria-live="polite" className="text-sm text-primary">{estado.exito}</p> : null}{estado.error ? <p aria-live="polite" className="text-sm text-destructive">{estado.error}</p> : null}</div>
    </form>
  );
}
