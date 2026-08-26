"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";

import { aceptarPedidoAdmin } from "@/app/(admin)/admin/pedidos/actions";
import { PendingButton } from "@/components/ui/pending-button";

export function OrderAcceptAction({ pedidoId }: { pedidoId: string }) {
  const router = useRouter();
  const [estado, accion, pendiente] = useActionState(aceptarPedidoAdmin, {});

  useEffect(() => {
    if (estado.aceptado) router.refresh();
  }, [estado.aceptado, router]);

  return (
    <form action={accion} className="space-y-2">
      <input type="hidden" name="pedidoId" value={pedidoId} />
      <PendingButton type="submit" pending={pendiente} pendingLabel="Aceptando…" className="w-full sm:w-auto">Aceptar pedido</PendingButton>
      <p aria-live="polite" className={estado.error ? "text-sm text-destructive" : "text-sm text-primary"}>
        {estado.error ?? (estado.aceptado ? "Pedido confirmado." : "")}
      </p>
    </form>
  );
}
