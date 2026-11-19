"use client";

import { Dialog } from "@base-ui/react/dialog";
import { useRef, useState, useTransition, type FormEvent } from "react";

import { gestionarSeccionInicio } from "@/app/(admin)/admin/secciones-inicio/actions";
import type { HomeSectionModal } from "@/components/admin/home-section-editor";
import { Button } from "@/components/ui/button";
import { PendingButton } from "@/components/ui/pending-button";
import { HOME_SECTION_ICONS } from "@/lib/home-section-icons";

const fieldClass = "mt-1 min-h-11 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50";

export function HomeSectionDialog({ modal, close, complete, finalFocus }: {
  modal: HomeSectionModal;
  close: () => void;
  complete: (message: string) => void;
  finalFocus: () => HTMLElement | null;
}) {
  const section = modal.type === "crear" ? null : modal.section;
  const deleting = modal.type === "eliminar";
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const submitting = useRef(false);
  const cancelButton = useRef<HTMLButtonElement | null>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const data = new FormData(event.currentTarget);
    submitting.current = true;
    setError("");

    startTransition(async () => {
      try {
        const result = await gestionarSeccionInicio({}, data);
        if (result.exito) complete(result.exito);
        else setError(result.error ?? "No fue posible actualizar la sección.");
      } catch {
        setError("No pudimos confirmar el cambio. Recarga la pestaña para comprobar el resultado.");
      } finally {
        submitting.current = false;
      }
    });
  }

  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open && !submitting.current) close(); }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="motion-dialog-backdrop fixed inset-0 z-50 bg-foreground/25" />
        <Dialog.Viewport className="fixed inset-0 z-50 flex items-end justify-center p-2 sm:items-center sm:p-4">
          <Dialog.Popup
            aria-busy={pending}
            initialFocus={deleting ? cancelButton : undefined}
            finalFocus={finalFocus}
            className="motion-dialog-content max-h-[calc(100dvh-1rem)] w-full max-w-lg overflow-y-auto overscroll-contain rounded-2xl border border-border bg-card p-4 shadow-xl outline-none sm:max-h-[85dvh] sm:p-6"
          >
            <Dialog.Title className="mb-4 text-lg font-semibold">
              {deleting ? "Eliminar sección" : section ? "Editar sección" : "Nueva sección"}
            </Dialog.Title>
            <form onSubmit={submit} className="space-y-4">
              <input type="hidden" name="operacion" value={modal.type} />
              <input type="hidden" name="seccionSlug" value={section?.slug ?? ""} />
              {deleting ? (
                <Dialog.Description className="break-words text-sm text-muted-foreground">
                  Se quitará «{section?.title}» de la portada junto con sus asignaciones. Los productos, pedidos e historial se conservarán.
                </Dialog.Description>
              ) : (
                <fieldset disabled={pending} className="min-w-0 space-y-4">
                  <label className="block text-sm font-medium">
                    Nombre
                    <input name="nombre" required maxLength={120} className={fieldClass} defaultValue={section?.title} />
                  </label>
                  <label className="block text-sm font-medium">
                    Descripción (opcional)
                    <textarea name="descripcion" maxLength={500} rows={3} className={fieldClass} defaultValue={section?.description ?? ""} />
                  </label>
                  <fieldset>
                    <legend className="mb-2 text-sm font-medium">Ícono</legend>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {Object.entries(HOME_SECTION_ICONS).map(([value, { label, Icon }]) => (
                        <label key={value} className="relative cursor-pointer">
                          <input name="icono" type="radio" value={value} defaultChecked={(section?.icon ?? "estrella") === value} className="peer sr-only" />
                          <span className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-input px-2 py-2 text-xs peer-checked:border-primary peer-checked:bg-muted peer-focus-visible:ring-2 peer-focus-visible:ring-ring">
                            <Icon aria-hidden="true" className="size-4 shrink-0 text-accent" /> {label}
                          </span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                </fieldset>
              )}
              {error && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
              <footer className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
                <Dialog.Close render={<Button ref={cancelButton} type="button" variant="outline" />} disabled={pending}>Cancelar</Dialog.Close>
                <PendingButton type="submit" variant={deleting ? "destructive" : "default"} pending={pending} pendingLabel={deleting ? "Eliminando…" : "Guardando…"}>
                  {deleting ? "Eliminar sección" : "Guardar sección"}
                </PendingButton>
              </footer>
            </form>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
