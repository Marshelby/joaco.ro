"use client";

import { useActionState, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";

import { guardarPreparacionItemPedido } from "@/app/(admin)/admin/pedidos/actions";
import { Button } from "@/components/ui/button";
import { formatearCantidadPreparacionEntrega } from "@/lib/delivery-preparation-quantity";
import { resolverModoCantidadPreparacion } from "@/lib/order-preparation";

type ItemPreparacionPedidoControl = {
  id: string;
  nombreProducto: string;
  nombrePresentacion: string | null;
  unidad: string;
  cantidad: number;
  modoCantidadSnapshot: "kg_fraccionable" | "presentacion_cerrada" | "unidad" | null;
  cantidadPreparada: number | null;
  motivoFaltante: string | null;
  tieneFaltante: boolean;
};

type PreparationItemControlProps = {
  item: ItemPreparacionPedidoControl;
};

export function PreparationItemControl({ item }: PreparationItemControlProps) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [resultado, accion, pendiente] = useActionState(guardarPreparacionItemPedido, {});
  const modo = resolverModoCantidadPreparacion({
    modoCantidadSnapshot: item.modoCantidadSnapshot,
    unidad: item.unidad,
    nombrePresentacion: item.nombrePresentacion,
  });
  const cantidadEfectiva = item.cantidadPreparada ?? item.cantidad;
  const cantidadFaltante = item.cantidad - cantidadEfectiva;
  const estaCompleto = !item.tieneFaltante;
  const mostrarEdicion = editando && !resultado.guardado;
  const step = modo === "kg_fraccionable" ? "0.5" : "1";

  useEffect(() => {
    if (!resultado.guardado && !resultado.error) return;
    router.refresh();
  }, [resultado.error, resultado.guardado, router]);

  return (
    <li className="min-w-0 py-3">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="break-words text-sm font-medium text-foreground">{item.nombreProducto}</p>
          {item.nombrePresentacion ? <p className="mt-0.5 break-words text-xs text-muted-foreground">{item.nombrePresentacion}</p> : null}
          <p className="mt-2 text-sm text-muted-foreground">Solicitado: <span className="font-medium text-foreground">{formatearCantidadPreparacionEntrega(item.cantidad, item.nombrePresentacion, item.unidad, item.modoCantidadSnapshot)}</span></p>
        </div>
        {!mostrarEdicion ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {estaCompleto ? <p className="inline-flex items-center gap-1.5 text-sm font-medium text-primary"><CheckCircle2 className="size-4" aria-hidden="true" />Completo</p> : <p className="inline-flex items-center gap-1.5 text-sm font-medium text-destructive"><AlertTriangle className="size-4" aria-hidden="true" />Faltante</p>}
            <Button type="button" variant="outline" size="sm" onClick={() => setEditando(true)} disabled={pendiente}>{estaCompleto ? "Marcar faltante" : "Editar faltante"}</Button>
          </div>
        ) : null}
      </div>

      {!mostrarEdicion && !estaCompleto ? (
        <div className="mt-3 grid gap-1 rounded-lg bg-destructive/5 p-3 text-sm sm:grid-cols-3 sm:gap-3">
          <p>Preparado: <span className="font-semibold text-foreground">{formatearCantidadPreparacionEntrega(cantidadEfectiva, item.nombrePresentacion, item.unidad, item.modoCantidadSnapshot)}</span></p>
          <p>Faltan: <span className="font-semibold text-foreground">{formatearCantidadPreparacionEntrega(cantidadFaltante, item.nombrePresentacion, item.unidad, item.modoCantidadSnapshot)}</span></p>
          {item.motivoFaltante ? <p className="break-words sm:col-span-3">Motivo: <span className="text-foreground">{item.motivoFaltante}</span></p> : null}
        </div>
      ) : null}

      {mostrarEdicion ? (
        <form action={accion} className="mt-3 grid gap-3 rounded-lg border border-border bg-background p-3 sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)]">
          <input type="hidden" name="itemPedidoId" value={item.id} />
          <label className="text-sm font-medium text-foreground">Cantidad preparada
            <input name="cantidadPreparada" type="number" inputMode="decimal" min="0" max={item.cantidad} step={step} defaultValue={cantidadEfectiva} required disabled={pendiente} className="mt-1.5 h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50" />
          </label>
          <label className="text-sm font-medium text-foreground">Motivo <span className="font-normal text-muted-foreground">(opcional)</span>
            <textarea name="motivo" maxLength={400} rows={2} defaultValue={item.motivoFaltante ?? ""} placeholder="Ej. Sin stock suficiente" disabled={pendiente} className="mt-1.5 w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50" />
          </label>
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <Button type="submit" disabled={pendiente}>{pendiente ? "Guardando…" : "Guardar faltante"}</Button>
            <Button type="submit" variant="outline" name="volverACompleto" value="true" disabled={pendiente}>Volver a completo</Button>
            <Button type="button" variant="ghost" onClick={() => setEditando(false)} disabled={pendiente}>Cancelar</Button>
          </div>
          <p aria-live="polite" className={`text-sm sm:col-span-2 ${resultado.error ? "text-destructive" : "text-primary"}`}>{resultado.error ?? (resultado.guardado ? resultado.completo ? "Producto marcado como completo." : "Faltante guardado." : "")}</p>
        </form>
      ) : null}
    </li>
  );
}
