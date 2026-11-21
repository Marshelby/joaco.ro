"use client";

import { AlertDialog } from "@base-ui/react/alert-dialog";
import { useRef, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";

type ConfirmationRequest = {
  onConfirm: () => void;
  returnFocus: HTMLElement | null;
};

export function useConfirmation() {
  const pending = useRef<ConfirmationRequest | null>(null);
  const [request, setRequest] = useState<ConfirmationRequest | null>(null);

  function ask(onConfirm: () => void, trigger = document.activeElement) {
    if (pending.current) return;
    const next = { onConfirm, returnFocus: trigger instanceof HTMLElement ? trigger : null };
    pending.current = next;
    setRequest(next);
  }

  function resolve(accepted: boolean) {
    const current = pending.current;
    if (!current) return;
    pending.current = null;
    setRequest(null);
    if (accepted) current.onConfirm();
  }

  return { ask, request, resolve };
}

export function useSubmitConfirmation(required = true) {
  const confirmation = useConfirmation();
  const approved = useRef(false);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    if (!required || approved.current) return;
    event.preventDefault();

    const form = event.currentTarget;
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    confirmation.ask(() => {
      if (!form.isConnected) return;
      if (submitter instanceof HTMLButtonElement || submitter instanceof HTMLInputElement) {
        if (submitter.form !== form || submitter.matches(":disabled")) return;
      }
      approved.current = true;
      try {
        form.requestSubmit(submitter ?? undefined);
      } finally {
        approved.current = false;
      }
    }, submitter ?? document.activeElement);
  }

  return { ...confirmation, onSubmit };
}

export function ConfirmationDialog({ confirmation, title, description, confirmLabel, cancelLabel = "Cancelar", destructive = false }: {
  confirmation: ReturnType<typeof useConfirmation>;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
}) {
  const cancelButton = useRef<HTMLButtonElement>(null);
  const { request, resolve } = confirmation;
  if (!request) return null;

  return (
    <AlertDialog.Root open onOpenChange={(open) => {
      if (!open) resolve(false);
    }}>
      <AlertDialog.Portal>
        <AlertDialog.Backdrop forceRender className="motion-dialog-backdrop fixed inset-0 z-[60] bg-foreground/35" />
        <AlertDialog.Viewport className="fixed inset-0 z-[60] flex items-end justify-center p-3 sm:items-center sm:p-4">
          <AlertDialog.Popup
            initialFocus={cancelButton}
            finalFocus={() => request.returnFocus?.isConnected ? request.returnFocus : undefined}
            className="motion-dialog-content max-h-[calc(100dvh-1.5rem)] w-full max-w-sm overflow-y-auto overscroll-contain rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-xl outline-none sm:p-5"
          >
            <AlertDialog.Title className="text-lg font-semibold tracking-tight">{title}</AlertDialog.Title>
            <AlertDialog.Description className="mt-2 break-words text-sm leading-6 text-muted-foreground">
              {description}
            </AlertDialog.Description>
            <div className="mt-4 grid gap-2 border-t border-border pt-4 sm:flex sm:justify-end">
              <AlertDialog.Close render={<Button ref={cancelButton} type="button" variant="outline" className="min-h-11" />}>
                {cancelLabel}
              </AlertDialog.Close>
              <Button type="button" variant={destructive ? "destructive" : "default"} className="min-h-11" onClick={() => resolve(true)}>
                {confirmLabel}
              </Button>
            </div>
          </AlertDialog.Popup>
        </AlertDialog.Viewport>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

export function DiscardChangesDialog({ confirmation }: { confirmation: ReturnType<typeof useConfirmation> }) {
  return (
    <ConfirmationDialog
      confirmation={confirmation}
      title="¿Descartar los cambios sin guardar?"
      description="Los cambios de este formulario se perderán al cerrarlo."
      confirmLabel="Descartar cambios"
      destructive
    />
  );
}
