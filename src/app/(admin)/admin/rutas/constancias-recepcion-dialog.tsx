"use client";

import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import type { PedidoConstancia } from "./constancias-recepcion-pdf";

type Props = { fecha: string; fechaProgramada: string; pedidos: readonly PedidoConstancia[] };

export function ConstanciasRecepcionDialog({ fecha, fechaProgramada, pedidos }: Props) {
  const [seleccion, setSeleccion] = useState<Set<string>>(() => new Set());
  const [documento, setDocumento] = useState<Blob | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState(false);
  const [conPrecios, setConPrecios] = useState(false);
  const total = pedidos.filter(pedido => seleccion.has(pedido.id)).length;
  const todos = total > 0 && total === pedidos.length;

  useEffect(() => {
    if (!documento) return;
    const enlace = URL.createObjectURL(documento);
    setUrl(enlace);
    return () => URL.revokeObjectURL(enlace);
  }, [documento]);

  function limpiarDocumento() {
    setUrl(null);
    setDocumento(null);
    setError(false);
  }

  function cambiarSeleccion(nueva: Set<string>) {
    setSeleccion(nueva);
    limpiarDocumento();
  }

  function cambiarFormato(precios: boolean) {
    setConPrecios(precios);
    limpiarDocumento();
  }

  async function generar() {
    setGenerando(true);
    limpiarDocumento();
    try {
      const { generarPdfConstancias } = await import("./constancias-recepcion-pdf");
      setDocumento(await generarPdfConstancias(pedidos.filter(pedido => seleccion.has(pedido.id)), fechaProgramada, conPrecios));
    } catch {
      setError(true);
    } finally {
      setGenerando(false);
    }
  }

  return <Dialog.Root>
    <Dialog.Trigger className={buttonVariants({ variant: "outline" })} disabled={!pedidos.length}>Generar constancias</Dialog.Trigger>
    <Dialog.Portal>
      <Dialog.Backdrop className="fixed inset-0 z-50 bg-foreground/30" />
      <Dialog.Viewport className="fixed inset-0 z-50 flex items-center justify-center p-3">
        <Dialog.Popup className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-lg flex-col overflow-hidden rounded-xl border bg-card shadow-xl">
          <header className="relative border-b p-4 pr-14">
            <Dialog.Title className="font-semibold">Generar constancias</Dialog.Title>
            <Dialog.Description className="text-sm text-muted-foreground">Fecha programada: {fechaProgramada}</Dialog.Description>
            <Dialog.Close aria-label="Cerrar" className={buttonVariants({ variant: "ghost", className: "absolute right-2 top-2 size-11 px-0" })}><X aria-hidden="true" /></Dialog.Close>
          </header>
          <label className="flex min-h-11 items-center gap-3 border-b px-4 text-sm font-medium">
            <input type="checkbox" checked={todos} ref={input => { if (input) input.indeterminate = total > 0 && !todos; }} disabled={generando} onChange={event => cambiarSeleccion(new Set(event.target.checked ? pedidos.map(pedido => pedido.id) : []))} />
            Seleccionar todos
          </label>
          <ul className="min-h-0 divide-y overflow-y-auto px-4">
            {pedidos.map(pedido => <li key={pedido.id}>
              <label className="flex min-h-11 cursor-pointer items-center gap-3 py-2 text-sm">
                <input type="checkbox" checked={seleccion.has(pedido.id)} disabled={generando} onChange={event => {
                  const nueva = new Set(seleccion);
                  if (event.target.checked) nueva.add(pedido.id);
                  else nueva.delete(pedido.id);
                  cambiarSeleccion(nueva);
                }} />
                <span className="min-w-0 wrap-anywhere"><strong>{pedido.destinatario}</strong><span className="block text-xs text-muted-foreground">{pedido.numero} · {pedido.direccion}</span></span>
              </label>
            </li>)}
          </ul>
          <footer className="space-y-2 border-t p-4">
            <fieldset disabled={generando} className="flex flex-wrap gap-x-5 text-sm">
              <legend className="font-medium">Formato del PDF</legend>
              <label className="flex min-h-11 items-center gap-2">
                <input type="radio" name="formato-constancias" checked={!conPrecios} onChange={() => cambiarFormato(false)} />
                Sin precios
              </label>
              <label className="flex min-h-11 items-center gap-2">
                <input type="radio" name="formato-constancias" checked={conPrecios} onChange={() => cambiarFormato(true)} />
                Con precios
              </label>
            </fieldset>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm text-muted-foreground" role="status">{total} de {pedidos.length} seleccionados</span>
              <Button type="button" disabled={!total || generando} onClick={generar}>{generando ? "Generando…" : "Generar PDF"}</Button>
            </div>
            {error && <p role="alert" className="text-sm text-destructive">No se pudo generar el PDF. Intenta nuevamente.</p>}
            {documento && url && <div className="flex flex-wrap gap-2">
              <a className={buttonVariants({ variant: "outline" })} href={url} target="_blank" rel="noopener">Ver PDF</a>
              <a className={buttonVariants({ variant: "outline" })} href={url} download={`constancias-${fecha}.pdf`}>Descargar PDF</a>
            </div>}
          </footer>
        </Dialog.Popup>
      </Dialog.Viewport>
    </Dialog.Portal>
  </Dialog.Root>;
}
