"use client";

import { useActionState } from "react";

import { desactivarDireccionCliente } from "@/app/(customer)/mi-cuenta/actions";
import { PendingButton } from "@/components/ui/pending-button";

export function AddressDeactivateAction({ direccionId }: { direccionId: string }) {
  const [estado, accion, pendiente] = useActionState(desactivarDireccionCliente, {});
  return <form action={accion} className="flex flex-wrap items-center gap-2"><input type="hidden" name="direccionId" value={direccionId} /><PendingButton type="submit" variant="ghost" pending={pendiente} pendingLabel="Desactivando…">Desactivar</PendingButton>{estado.error ? <span aria-live="polite" className="text-sm text-destructive">{estado.error}</span> : null}</form>;
}
