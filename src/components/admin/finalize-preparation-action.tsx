"use client";

import { Dialog } from "@base-ui/react/dialog";
import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { finalizarPreparacionPedidoAction, type EstadoFinalizacionPreparacion } from "@/app/(admin)/admin/pedidos/actions";
import { Button } from "@/components/ui/button";
import { PendingButton } from "@/components/ui/pending-button";

export function FinalizePreparationAction({ pedidoId, numeroPedido, lineasConFaltantes, pendientes, version, reautorizar = false }: { pedidoId: string; numeroPedido: string; lineasConFaltantes: number; pendientes: number; version: number; reautorizar?: boolean }) {
  const router = useRouter();
  const [avisoEdicion, setAvisoEdicion] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [clave, setClave] = useState("");
  const solicitud = useRef<FormData | null>(null);
  const [enviada, setEnviada] = useState(false);
  const [resultado, accion, pendiente] = useActionState(async (previo: EstadoFinalizacionPreparacion, datos: FormData): Promise<EstadoFinalizacionPreparacion> => {
    solicitud.current ??= datos;
    setEnviada(true);
    try { return await finalizarPreparacionPedidoAction(previo, solicitud.current); }
    catch { return { error: "Respuesta no recibida. Reintenta la misma solicitud o consulta el estado actualizado." }; }
  }, {});
  useEffect(() => { if (resultado.finalizado) router.refresh(); }, [resultado.error, resultado.finalizado, router]);
  return <Dialog.Root open={abierto && !resultado.finalizado} onOpenChange={(valor) => { setAbierto(valor); if (valor && !solicitud.current) setClave(crypto.randomUUID()); }}><Dialog.Trigger render={<Button type="button" className="w-full sm:w-auto" disabled={pendientes > 0} />}>{reautorizar ? "Autorizar preparación parcial" : "Pedidos preparados"}</Dialog.Trigger><Dialog.Portal><Dialog.Backdrop className="motion-dialog-backdrop fixed inset-0 z-50 bg-foreground/25" /><Dialog.Viewport className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"><Dialog.Popup className="motion-dialog-content max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-xl outline-none sm:p-6"><Dialog.Title className="text-lg font-semibold text-foreground">¿Pedidos preparados?</Dialog.Title><Dialog.Description className="mt-2 text-sm leading-6 text-muted-foreground">Después de finalizar, las cantidades preparadas quedarán cerradas y {numeroPedido} pasará a listo para despacho. Esta confirmación no registra la salida de la ruta.</Dialog.Description><p className="mt-2 text-sm text-muted-foreground">{lineasConFaltantes > 0 ? `Este pedido tiene ${lineasConFaltantes} ${lineasConFaltantes === 1 ? "línea con diferencia" : "líneas con diferencias"}.` : "Todos los productos cuentan con confirmación explícita."}</p><form action={accion} onSubmit={e => { if (document.querySelector(`[data-preparacion-pedido="${pedidoId}"] [data-preparacion-pendiente="true"]`)) { e.preventDefault(); setAvisoEdicion("Guarda o cancela los cambios de productos antes de confirmar."); } else { setAvisoEdicion(""); } }} className="mt-5 space-y-4"><input type="hidden" name="pedidoId" value={pedidoId} /><input type="hidden" name="version" value={version} /><input type="hidden" name="clave" value={clave} />{lineasConFaltantes > 0 ? <fieldset disabled={pendiente} className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/40 p-3"><legend className="px-1 text-sm font-semibold">Autorización administrativa del parcial</legend><label className="block text-sm">Motivo<textarea name="motivo" readOnly={enviada} required maxLength={2000} rows={3} className="mt-1 w-full rounded-lg border bg-background p-2" /></label><label className="flex min-h-11 items-start gap-3 text-sm"><input type="checkbox" name="autorizaParcial" value="si" onClick={e => { if (enviada) e.preventDefault(); }} required className="mt-1" />Autorizo finalizar con las cantidades e importes confirmados. La salida se registra por separado.</label></fieldset> : null}{enviada && !resultado.finalizado ? <Button type="button" variant="outline" disabled={pendiente} onClick={() => { solicitud.current = null; setEnviada(false); setClave(crypto.randomUUID()); router.refresh(); }}>Consultar estado actualizado</Button> : null}{avisoEdicion ? <p role="alert" className="text-sm text-destructive">{avisoEdicion}</p> : null}{resultado.error ? <p aria-live="polite" className="text-sm text-destructive">{resultado.error}</p> : null}<div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => setAbierto(false)} disabled={pendiente || pendientes > 0}>Volver</Button><PendingButton type="submit" disabled={pendientes > 0} pending={pendiente} pendingLabel="Finalizando…" className="w-full sm:w-auto">Pedidos preparados</PendingButton></div></form></Dialog.Popup></Dialog.Viewport></Dialog.Portal></Dialog.Root>;
}
