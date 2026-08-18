"use client";

import { Dialog } from "@base-ui/react/dialog";
import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { finalizarPreparacionPedidoAction } from "@/app/(admin)/admin/pedidos/actions";
import { Button } from "@/components/ui/button";

export function FinalizePreparationAction({ pedidoId, numeroPedido, lineasConFaltantes }: { pedidoId: string; numeroPedido: string; lineasConFaltantes: number }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [resultado, accion, pendiente] = useActionState(finalizarPreparacionPedidoAction, {});
  useEffect(() => { if (resultado.finalizado || resultado.error) router.refresh(); }, [resultado.error, resultado.finalizado, router]);
  return <Dialog.Root open={abierto && !resultado.finalizado} onOpenChange={setAbierto}><Dialog.Trigger render={<Button type="button" className="w-full sm:w-auto" />}>Finalizar preparación</Dialog.Trigger><Dialog.Portal><Dialog.Backdrop className="fixed inset-0 z-50 bg-foreground/25" /><Dialog.Viewport className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"><Dialog.Popup className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-xl outline-none sm:p-6"><Dialog.Title className="text-lg font-semibold text-foreground">¿Finalizar preparación?</Dialog.Title><Dialog.Description className="mt-2 text-sm leading-6 text-muted-foreground">Después de finalizar, las cantidades preparadas quedarán cerradas y {numeroPedido} pasará a listo para despacho.</Dialog.Description><p className="mt-2 text-sm text-muted-foreground">{lineasConFaltantes > 0 ? `Este pedido tiene ${lineasConFaltantes} ${lineasConFaltantes === 1 ? "línea con faltante" : "líneas con faltantes"}.` : "Todos los productos se registrarán como preparados completamente."}</p><form action={accion} className="mt-5 space-y-4"><input type="hidden" name="pedidoId" value={pedidoId} />{resultado.error ? <p aria-live="polite" className="text-sm text-destructive">{resultado.error}</p> : null}<div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => setAbierto(false)} disabled={pendiente}>Volver</Button><Button type="submit" className="w-full sm:w-auto" disabled={pendiente}>{pendiente ? "Finalizando…" : "Finalizar preparación"}</Button></div></form></Dialog.Popup></Dialog.Viewport></Dialog.Portal></Dialog.Root>;
}
