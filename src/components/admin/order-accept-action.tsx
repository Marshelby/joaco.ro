"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";

import { aceptarPedidoAdmin } from "@/app/(admin)/admin/pedidos/actions";
import { Button } from "@/components/ui/button";

export function OrderAcceptAction({ pedidoId }: { pedidoId: string }) {
  const router = useRouter();
  const [estado, accion, pendiente] = useActionState(aceptarPedidoAdmin, {});

  useEffect(() => {
    if (estado.aceptado) router.refresh();
  }, [estado.aceptado, router]);

  return (
    <form action={accion} className="space-y-2">
      <input type="hidden" name="pedidoId" value={pedidoId} />
      <Button type="submit" className="w-full sm:w-auto" disabled={pendiente}>
        {pendiente ? "Aceptando…" : "Aceptar pedido"}
      </Button>
      <p aria-live="polite" className={estado.error ? "text-sm text-destructive" : "text-sm text-primary"}>
        {estado.error ?? (estado.aceptado ? "Pedido confirmado." : "")}
      </p>
    </form>
  );
}
