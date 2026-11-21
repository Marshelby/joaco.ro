"use client";

import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { useActionState, useEffect, useState, type RefObject } from "react";

import { guardarDireccionCliente } from "@/app/(customer)/mi-cuenta/actions";
import { campoDireccion } from "@/components/account/address-form-styles";
import { CustomerAddressMap, type AddressCoordinates } from "@/components/account/customer-address-map";
import { Button } from "@/components/ui/button";
import { PendingButton } from "@/components/ui/pending-button";
import { cn } from "@/lib/utils";

export type DireccionClienteFormulario = {
  id?: string;
  destinatario: string | null;
  telefonoContacto: string | null;
  direccion: string;
  zonaEntregaId: string | null;
  referencia: string | null;
  esPrincipal: boolean;
  latitud: number | null;
  longitud: number | null;
};

export type ZonaEntregaFormulario = { id: string; nombre: string };

const campo = cn(campoDireccion, "mt-1");
const mensajesCampo: Record<string, string> = {
  destinatario: "Ingresa el nombre de quien recibirá el pedido.",
  telefonoContacto: "Ingresa los ocho dígitos del teléfono después de +56 9.",
  direccion: "Ingresa la dirección de entrega.",
  zonaEntregaId: "Selecciona una comuna o zona de entrega.",
};

function obtenerDigitosTelefono(telefono: string | null | undefined) {
  return (telefono ?? "").replace(/\D/g, "").replace(/^569/, "").slice(0, 8);
}

export function CustomerAddressForm({ direccion, zonas, errorZonas, trigger, onClose }: {
  direccion?: DireccionClienteFormulario;
  zonas: readonly ZonaEntregaFormulario[];
  errorZonas: boolean;
  trigger: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
}) {
  const [estado, accion, pendiente] = useActionState(guardarDireccionCliente, {});
  const [mensajeCampo, setMensajeCampo] = useState<string>();
  const [initialFields] = useState(() => ({
    destinatario: direccion?.destinatario ?? "",
    telefonoContacto: obtenerDigitosTelefono(direccion?.telefonoContacto),
    direccion: direccion?.direccion ?? "",
    zonaEntregaId: zonas.find((zona) => zona.id === direccion?.zonaEntregaId)?.id ?? "",
    referencia: direccion?.referencia ?? "",
    esPrincipal: direccion?.esPrincipal ?? false,
  }));
  const initialCoordinates = { latitude: direccion?.latitud ?? null, longitude: direccion?.longitud ?? null };
  const [fields, setFields] = useState(initialFields);
  const [coordinates, setCoordinates] = useState<AddressCoordinates>(initialCoordinates);
  const { latitude, longitude } = coordinates;
  const locationIsValid = latitude !== null && longitude !== null && Number.isFinite(latitude) && Number.isFinite(longitude)
    && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;

  useEffect(() => {
    if (estado.exito) onClose();
  }, [estado.exito, onClose]);

  function updateField<Key extends keyof typeof fields>(name: Key, value: (typeof fields)[Key]) {
    setFields((current) => ({ ...current, [name]: value }));
    setMensajeCampo(undefined);
  }

  function requestClose() {
    if (pendiente) return;
    const dirty = (Object.keys(initialFields) as (keyof typeof fields)[]).some((key) => fields[key] !== initialFields[key])
      || latitude !== initialCoordinates.latitude || longitude !== initialCoordinates.longitude;
    if (!dirty || window.confirm("¿Descartar los cambios sin guardar?")) onClose();
  }

  return (
    <Dialog.Root open disablePointerDismissal onOpenChange={(open, details) => {
      if (open) return;
      details.cancel();
      requestClose();
    }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-foreground/25 backdrop-blur-[1px]" />
        <Dialog.Viewport className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
          <Dialog.Popup finalFocus={trigger} className="flex max-h-[calc(100dvh_-_1rem)] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xl outline-none sm:max-h-[calc(100dvh_-_2rem)]">
            <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border/70 bg-primary/[0.03] px-3 py-1.5 sm:px-5">
              <Dialog.Title className="text-lg font-semibold tracking-tight text-foreground">
                {direccion?.id ? "Editar dirección" : "Nueva dirección"}
              </Dialog.Title>
              <Dialog.Close type="button" aria-label="Cerrar" disabled={pendiente} className="grid size-11 shrink-0 place-items-center rounded-lg hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50">
                <X className="size-5" aria-hidden="true" />
              </Dialog.Close>
            </header>

            <form
              action={accion}
              aria-busy={pendiente}
              className="flex min-h-0 flex-col"
              onInvalidCapture={(event) => {
                const invalid = event.target as HTMLInputElement | HTMLSelectElement;
                // La validación nativa enfoca el primer campo inválido.
                if (event.currentTarget.querySelector(":invalid") === invalid) {
                  setMensajeCampo(mensajesCampo[invalid.name] ?? invalid.validationMessage);
                }
              }}
              onSubmit={() => setMensajeCampo(undefined)}
            >
              <input type="hidden" name="direccionId" value={direccion?.id ?? ""} />
              <input type="hidden" name="latitud" value={latitude ?? ""} />
              <input type="hidden" name="longitud" value={longitude ?? ""} />

              <div inert={pendiente} className="min-h-0 overflow-y-auto overscroll-contain px-3 py-3 sm:px-5">
                <div className="grid gap-x-3 gap-y-2.5 min-[380px]:grid-cols-2">
                  <label className="min-w-0 text-sm font-medium text-foreground">
                    Nombre destinatario
                    <input required name="destinatario" autoComplete="name" value={fields.destinatario} onChange={(event) => updateField("destinatario", event.target.value)} className={campo} />
                  </label>
                  <label className="min-w-0 text-sm font-medium text-foreground">
                    Teléfono de contacto
                    <span className="mt-1 flex min-w-0">
                      <span className="inline-flex h-11 shrink-0 items-center rounded-l-lg border border-r-0 border-input bg-muted px-2.5 text-sm text-muted-foreground" aria-hidden="true">+56 9</span>
                      <input required name="telefonoContacto" type="tel" inputMode="numeric" autoComplete="tel-national" value={fields.telefonoContacto} onChange={(event) => updateField("telefonoContacto", event.target.value.replace(/\D/g, "").slice(0, 8))} maxLength={8} pattern="[0-9]{8}" aria-label="Ocho dígitos del teléfono de contacto, después de +56 9" className="h-11 min-w-0 flex-1 rounded-r-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50" />
                    </span>
                  </label>
                  <label className="min-w-0 text-sm font-medium text-foreground">
                    Dirección
                    <input required name="direccion" value={fields.direccion} onChange={(event) => updateField("direccion", event.target.value)} className={campo} />
                  </label>
                  <label className="min-w-0 text-sm font-medium text-foreground">
                    Comuna / zona de entrega
                    <select required name="zonaEntregaId" value={fields.zonaEntregaId} onChange={(event) => updateField("zonaEntregaId", event.target.value)} className={campo}>
                      <option value="" disabled>Selecciona una zona</option>
                      {zonas.map((zona) => <option key={zona.id} value={zona.id}>{zona.nombre}</option>)}
                    </select>
                  </label>
                  <label className="col-span-full text-sm font-medium text-foreground">
                    Referencia
                    <textarea name="referencia" value={fields.referencia} onChange={(event) => updateField("referencia", event.target.value)} rows={1} className="mt-1 block min-h-10 w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50" />
                  </label>
                  <label className="col-span-full flex min-h-9 items-center gap-2 text-sm font-medium text-foreground">
                    <input name="esPrincipal" type="checkbox" className="size-4 shrink-0 accent-primary" checked={fields.esPrincipal} onChange={(event) => updateField("esPrincipal", event.target.checked)} />
                    Usar como dirección principal
                  </label>
                  <div className="isolate col-span-full min-w-0 rounded-xl border border-border/70 bg-muted/30 p-2.5">
                    <CustomerAddressMap compact latitude={latitude} longitude={longitude} onCoordinatesChange={setCoordinates} />
                  </div>
                </div>
              </div>

              <footer className="shrink-0 space-y-2 border-t border-border/70 bg-primary/[0.03] px-3 py-2.5 sm:px-5">
                {errorZonas && <p role="alert" className="text-sm text-destructive">No pudimos cargar las comunas. Recarga la página e inténtalo nuevamente.</p>}
                {!locationIsValid && <p className="text-sm text-destructive">Marca la ubicación exacta en el mapa antes de guardar.</p>}
                {(mensajeCampo || estado.error) && <p role="alert" className="text-sm text-destructive">{mensajeCampo || estado.error}</p>}
                <div className="flex justify-end gap-2">
                  <Dialog.Close render={<Button type="button" variant="outline" />} disabled={pendiente}>Cancelar</Dialog.Close>
                  <PendingButton type="submit" pending={pendiente} pendingLabel="Guardando…" disabled={!locationIsValid || errorZonas}>Guardar dirección</PendingButton>
                </div>
              </footer>
            </form>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
