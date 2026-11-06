"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { guardarPreparacionItemPedido } from "@/app/(admin)/admin/pedidos/actions";
import { Button } from "@/components/ui/button";
import { formatearCantidadPreparacionEntrega } from "@/lib/delivery-preparation-quantity";
import { resolverModoCantidadPreparacion } from "@/lib/order-preparation";
import { formatCLP } from "@/lib/formatters";
import type { ItemPreparacionPedidoAdmin } from "@/lib/admin/pedidos";

export function PreparationItemControl({ item, version, soloLectura = false }: { item: ItemPreparacionPedidoAdmin; version: number; soloLectura?: boolean }) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [clave, setClave] = useState("");
  const [cantidad, setCantidad] = useState(String(item.confirmadoExplicito ? item.cantidadPreparada : item.cantidad));
  const [importe, setImporte] = useState("");
  const [resultado, accion, pendiente] = useActionState(guardarPreparacionItemPedido, {});
  const modo = resolverModoCantidadPreparacion({ modoCantidadSnapshot: item.modoCantidadSnapshot, unidad: item.unidad, nombrePresentacion: item.nombrePresentacion });
  const cambia = cantidad !== "" && Number(cantidad) !== item.cantidad;
  const formatear = (valor: number) => formatearCantidadPreparacionEntrega(valor, item.nombrePresentacion, item.unidad, item.modoCantidadSnapshot);
  useEffect(() => { if (resultado.guardado || resultado.error) router.refresh(); }, [resultado, router]);
  const clase = "mt-1 w-full rounded-lg border border-input bg-background p-2";
  return <li className="space-y-3 py-3 text-sm">
    <p className="font-medium">{item.nombreProducto} {item.nombrePresentacion ? `· ${item.nombrePresentacion}` : ""}</p>
    <p className="font-semibold">{item.confirmadoExplicito ? "LISTO" : "PENDIENTE"}</p>
    <div className="grid gap-2 sm:grid-cols-2">
      <p>Solicitado: {formatear(item.cantidad)}<span className="block text-muted-foreground">Importe original: {formatCLP(item.importeOriginal)}</span></p>
      <p>Preparado: {item.confirmadoExplicito ? formatear(item.cantidadPreparada ?? 0) : "Sin confirmar"}<span className="block text-muted-foreground">Importe provisional: {item.confirmadoExplicito && item.importeOperativo !== null ? formatCLP(item.importeOperativo) : "Sin confirmar"}</span></p>
    </div>
    {!soloLectura && !editando ? <Button type="button" variant="outline" onClick={() => { setCantidad(String(item.confirmadoExplicito ? item.cantidadPreparada : item.cantidad)); setImporte(""); setClave(crypto.randomUUID()); setEditando(true); }}>{item.confirmadoExplicito ? "Corregir preparación" : "Listo"}</Button> : null}
    {!soloLectura && editando ? <form action={accion} className="space-y-3 rounded-lg border p-3">
      <input type="hidden" name="itemPedidoId" value={item.id} />
      <input type="hidden" name="version" value={version} />
      <input type="hidden" name="clave" value={clave} />
      <label className="block">Cantidad realmente preparada
        <input className={clase} name="cantidadPreparada" type="number" inputMode="decimal" min="0" max="999999999.999" step={modo === "kg_fraccionable" ? "0.001" : "1"} required value={cantidad} disabled={pendiente} onChange={(e) => { setCantidad(e.target.value); setImporte(""); setClave(crypto.randomUUID()); }} />
      </label>
      {cambia ? <label className="block">Nuevo importe total de venta de esta línea (CLP)
        <input className={clase} name="importe" type="number" inputMode="numeric" min="0" max="9007199254740991" step="1" required value={importe} disabled={pendiente} onChange={(e) => { setImporte(e.target.value); setClave(crypto.randomUUID()); }} />
        <span className="text-muted-foreground">Ingreso manual obligatorio; importe operativo provisional.</span>
      </label> : <p>Se conserva el importe autorizado: {formatCLP(item.importeOriginal)}.</p>}
      <label className="block">Motivo o detalle de la revisión
        <textarea className={clase} name="motivo" maxLength={400} disabled={pendiente} onChange={() => setClave(crypto.randomUUID())} />
      </label>
      <div className="flex gap-2"><Button type="submit" disabled={pendiente}>{pendiente ? "Guardando…" : "Confirmar listo"}</Button><Button type="button" variant="ghost" disabled={pendiente} onClick={() => setEditando(false)}>Cancelar</Button></div>
      <p aria-live="polite">{resultado.error ?? (resultado.guardado ? "Preparación guardada." : "")}</p>
    </form> : null}
  </li>;
}
