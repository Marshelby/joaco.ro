"use client";

import { useActionState } from "react";

import { desactivarDireccionCliente } from "@/app/(customer)/mi-cuenta/actions";
import { PendingButton } from "@/components/ui/pending-button";

export function AddressDeactivateAction({ direccionId }: { direccionId: string }) {
  const [estado, accion, pendiente] = useActionState(desactivarDireccionCliente, {});
  return (
    <form action={accion} className="flex flex-col items-end gap-1">
      <input type="hidden" name="direccionId" value={direccionId} />
      <PendingButton
        type="submit"
        variant="ghost"
        size="sm"
        className="h-9 aria-busy:min-w-36 text-muted-foreground"
        pending={pendiente}
        pendingLabel="Desactivando…"
      >
        Desactivar
      </PendingButton>
      {estado.error ? <span aria-live="polite" className="self-stretch break-words text-sm text-destructive">{estado.error}</span> : null}
    </form>
  );
}
