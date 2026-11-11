"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { resolverSinStockAction, type EstadoFinalizacionPreparacion } from "@/app/(admin)/admin/pedidos/actions";
import { Button } from "@/components/ui/button";
import { PendingButton } from "@/components/ui/pending-button";

export function SinStockAction({ pedidoId, version }: { pedidoId: string; version: number }) {
  const solicitud = useRef<FormData | null>(null);
  const [enviada, setEnviada] = useState(false);
  const [resultado, accion, pendiente] = useActionState(async (previo: EstadoFinalizacionPreparacion, datos: FormData): Promise<EstadoFinalizacionPreparacion> => {
    solicitud.current ??= datos;
    setEnviada(true);
    try { return await resolverSinStockAction(previo, solicitud.current); }
    catch { return { error: "Respuesta no recibida. Reintenta la misma solicitud o consulta el estado actualizado." }; }
  }, {});
  const [clave, setClave] = useState("");
  const router = useRouter();
  const [avisoEdicion, setAvisoEdicion] = useState("");
  useEffect(() => { if (resultado.finalizado) router.refresh(); }, [resultado.finalizado, router]);
  return <details className="mt-3 rounded-xl border border-amber-200 bg-amber-50/30 p-4"><summary className="min-h-11 cursor-pointer text-sm font-semibold" onClick={() => { if (!clave) setClave(crypto.randomUUID()); }}>Resolver falta total de stock</summary><p className="my-3 text-sm text-muted-foreground">Todos los productos tienen cantidad e importe cero confirmados. La resolución requiere confirmación expresa; retira el pedido del reparto y conserva su historial sin registrar venta, deuda ni cobro.</p><form action={accion} onSubmit={e => { if (document.querySelector('[data-preparacion-pendiente="true"]')) { e.preventDefault(); setAvisoEdicion("Guarda o cancela los cambios de productos antes de confirmar."); } else { setAvisoEdicion(""); } }} className="space-y-3"><input type="hidden" name="pedidoId" value={pedidoId} /><input type="hidden" name="version" value={version} /><input type="hidden" name="clave" value={clave} /><fieldset disabled={pendiente || Boolean(resultado.finalizado)} className="space-y-3"><label className="block text-sm">Motivo de falta de stock<textarea name="motivo" readOnly={enviada} required maxLength={2000} rows={3} className="mt-1 w-full rounded-lg border bg-background p-2" /></label><label className="flex min-h-11 items-start gap-3 text-sm"><input name="confirmaSinStock" value="si" type="checkbox" onClick={e => { if (enviada) e.preventDefault(); }} required className="mt-1" />Confirmo que no hay stock para ningún producto y resuelvo como No entregado — Sin stock.</label><PendingButton type="submit" pending={pendiente} pendingLabel="Resolviendo…" disabled={!clave}>No entregado — Sin stock</PendingButton></fieldset>{enviada && !resultado.finalizado ? <Button type="button" variant="outline" disabled={pendiente} onClick={() => { solicitud.current = null; setEnviada(false); setClave(crypto.randomUUID()); router.refresh(); }}>Consultar estado actualizado</Button> : null}<p role="status" className="text-sm">{avisoEdicion || resultado.error || (resultado.finalizado ? "Pedido resuelto y retirado del reparto físico." : "")}</p></form></details>;
}
