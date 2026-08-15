"use client";

import { useActionState, useState } from "react";

import { guardarDireccionCliente } from "@/app/(customer)/mi-cuenta/actions";
import { Button } from "@/components/ui/button";

export type DireccionClienteFormulario = {
  id?: string;
  destinatario: string | null;
  telefonoContacto: string | null;
  direccion: string;
  zonaEntregaId: string | null;
  referencia: string | null;
  esPrincipal: boolean;
};

export type ZonaEntregaFormulario = { id: string; nombre: string };

const campo = "mt-2 h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

function obtenerDigitosTelefono(telefono: string | null | undefined) {
  return (telefono ?? "").replace(/\D/g, "").replace(/^569/, "").slice(0, 8);
}

export function CustomerAddressForm({ direccion, zonas }: { direccion?: DireccionClienteFormulario; zonas: readonly ZonaEntregaFormulario[] }) {
  const [estado, accion, pendiente] = useActionState(guardarDireccionCliente, {});
  const [telefono, setTelefono] = useState(() => obtenerDigitosTelefono(direccion?.telefonoContacto));

  return (
    <form action={accion} className="space-y-5 rounded-xl border border-border bg-card p-5 sm:p-6">
      <input type="hidden" name="direccionId" value={direccion?.id ?? ""} />
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="text-sm font-medium text-foreground">Nombre destinatario<input required name="destinatario" defaultValue={direccion?.destinatario ?? ""} autoComplete="name" className={campo} /></label>
        <label className="text-sm font-medium text-foreground">Teléfono de contacto<span className="mt-2 flex min-w-0"><span className="inline-flex h-11 shrink-0 items-center rounded-l-lg border border-r-0 border-input bg-muted px-3 text-sm text-muted-foreground" aria-hidden="true">+56 9</span><input required name="telefonoContacto" type="tel" inputMode="numeric" autoComplete="tel-national" value={telefono} onChange={(event) => setTelefono(event.target.value.replace(/\D/g, "").slice(0, 8))} maxLength={8} aria-label="Ocho dígitos del teléfono de contacto, después de +56 9" className="h-11 min-w-0 flex-1 rounded-l-none border border-input bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50" /></span></label>
        <label className="text-sm font-medium text-foreground">Dirección<input required name="direccion" defaultValue={direccion?.direccion ?? ""} className={campo} /></label>
        <label className="text-sm font-medium text-foreground">Comuna / zona de entrega<select required name="zonaEntregaId" defaultValue={direccion?.zonaEntregaId ?? ""} className={campo}><option value="" disabled>Selecciona una zona</option>{zonas.map((zona) => <option key={zona.id} value={zona.id}>{zona.nombre}</option>)}</select></label>
        <label className="sm:col-span-2 text-sm font-medium text-foreground">Referencia<textarea name="referencia" defaultValue={direccion?.referencia ?? ""} rows={3} className="mt-2 w-full rounded-lg border border-input bg-background p-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50" /></label>
      </div>
      <label className="flex min-h-11 items-center gap-2 text-sm font-medium text-foreground"><input name="esPrincipal" type="checkbox" defaultChecked={direccion?.esPrincipal ?? false} /> Usar como dirección principal</label>
      <div className="flex flex-wrap items-center gap-3"><Button type="submit" disabled={pendiente}>{pendiente ? "Guardando…" : "Guardar dirección"}</Button>{estado.exito ? <p aria-live="polite" className="text-sm text-primary">{estado.exito}</p> : null}{estado.error ? <p role="alert" className="text-sm text-destructive">{estado.error}</p> : null}</div>
    </form>
  );
}
