"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Check, Copy, ReceiptText, X } from "lucide-react";
import { useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Button, buttonVariants } from "@/components/ui/button";

type Campo = { id: string; etiqueta: string; valor: string | null; ausente?: string };
type ValorCampo = Pick<Campo, "valor">;
export type PedidoFactura = {
  id: string;
  numero: string;
  cliente: string;
  estado: ReactNode;
  tributarios: Campo[];
  productos: { id: string; estado: string; campos: Campo[] }[];
};

function SesionFacturas({ pedidos }: { pedidos: readonly PedidoFactura[] }) {
  const [seleccion, setSeleccion] = useState<string | null>(null);
  const [copiados, setCopiados] = useState<Map<string, ValorCampo>>(() => new Map());
  const [error, setError] = useState(false);
  const valores = useRef(new Map<string, ValorCampo>());
  const detalleId = useId();
  const pedido = pedidos.find(pedido => pedido.id === seleccion);

  useLayoutEffect(() => {
    const siguientes = new Map<string, ValorCampo>();
    function registrar(prefijo: string, campos: Campo[]) {
      for (const campo of campos) {
        const clave = prefijo + campo.id;
        const anterior = valores.current.get(clave);
        siguientes.set(clave, anterior?.valor === campo.valor ? anterior : { valor: campo.valor });
      }
    }
    for (const pedido of pedidos) {
      registrar(`${pedido.id}:ficha:`, pedido.tributarios);
      for (const producto of pedido.productos) registrar(`${pedido.id}:${producto.id}:`, producto.campos);
    }
    valores.current = siguientes;
    setCopiados(anteriores => {
      const vigentes = new Map([...anteriores].filter(([clave, campo]) => siguientes.get(clave) === campo));
      return vigentes.size === anteriores.size ? anteriores : vigentes;
    });
  }, [pedidos]);

  async function copiar(clave: string, valor: string) {
    const campo = valores.current.get(clave);
    if (!campo || campo.valor !== valor) return;
    setError(false);
    try {
      await navigator.clipboard.writeText(valor);
      setCopiados(anteriores => valores.current.get(clave) === campo ? new Map(anteriores).set(clave, campo) : anteriores);
    } catch {
      setError(true);
    }
  }

  function mostrarCampos(prefijo: string, campos: Campo[]) {
    return <dl className="grid gap-x-4 sm:grid-cols-2">
      {campos.map(campo => {
        const clave = prefijo + campo.id;
        const valor = campo.valor;
        const copiado = copiados.get(clave)?.valor === valor;
        return <div key={campo.id} className={`relative min-w-0 border-b py-2 wrap-anywhere ${valor === null ? "" : "min-h-12 pr-11"}`}>
          <dt className="text-xs text-muted-foreground">{campo.etiqueta}</dt>
          <dd className="text-sm font-medium">
            {valor ?? campo.ausente ?? "Sin dato verificable"}
            {valor !== null && <Button type="button" variant="outline" size="icon-lg"
              className="absolute right-0 top-1/2 -translate-y-1/2" onClick={() => copiar(clave, valor)}
              aria-label={`${copiado ? "Copiado. Copiar de nuevo" : "Copiar"} ${campo.etiqueta}`}
              title={copiado ? "Copiado · Copiar de nuevo" : "Copiar"}>
              {copiado ? <Check className="text-emerald-700 dark:text-emerald-400" aria-hidden="true" /> : <Copy aria-hidden="true" />}
            </Button>}
          </dd>
        </div>;
      })}
    </dl>;
  }

  return <>
    {error && <p role="alert" className="mb-2 text-sm text-destructive">No se pudo copiar. Intenta nuevamente.</p>}
    {pedidos.length === 0 ? <p className="text-sm text-muted-foreground">No hay pedidos con ficha tributaria para esta fecha.</p> :
      <ul className="divide-y">
        {pedidos.map(fila => <li key={fila.id} className="py-2 first:pt-0">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 space-y-1">
              <p className="wrap-anywhere text-sm font-semibold">{fila.cliente} <span className="font-normal text-muted-foreground">· Pedido {fila.numero}</span></p>
              <div className="flex flex-wrap gap-1">{fila.estado}</div>
            </div>
            <Button type="button" variant="outline" className="shrink-0"
              aria-expanded={pedido?.id === fila.id} aria-controls={pedido?.id === fila.id ? detalleId : undefined}
              onClick={() => { setSeleccion(pedido?.id === fila.id ? null : fila.id); setError(false); }}>
              {pedido?.id === fila.id ? "Ocultar datos" : "Ver datos"}
            </Button>
          </div>
          {pedido?.id === fila.id && <div id={detalleId} className="mt-2 space-y-3 rounded-lg border bg-background p-3">
            <section>
              <h3 className="text-sm font-semibold">Ficha tributaria</h3>
              {mostrarCampos(`${fila.id}:ficha:`, fila.tributarios)}
            </section>
            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Productos</h3>
              {!fila.productos.length && <p className="text-sm text-muted-foreground">Sin líneas registradas.</p>}
              {fila.productos.map(producto => <div key={producto.id} className="rounded-lg border p-2.5">
                <p className="text-xs font-medium text-muted-foreground">{producto.estado}</p>
                {mostrarCampos(`${fila.id}:${producto.id}:`, producto.campos)}
              </div>)}
              <p className="text-xs text-muted-foreground">Totales tributarios no disponibles. Falta verificar el tratamiento de IVA de las líneas.</p>
            </section>
          </div>}
        </li>)}
      </ul>}
  </>;
}

export function FacturasDelDiaDialog({ fecha, pedidos, errorConsulta = false }: {
  fecha: string;
  pedidos: readonly PedidoFactura[];
  errorConsulta?: boolean;
}) {
  const [abierto, setAbierto] = useState(false);

  return <Dialog.Root open={abierto} onOpenChange={setAbierto}>
    <Dialog.Trigger className={buttonVariants({ variant: "outline" })}>
      <ReceiptText aria-hidden="true" /> Facturas del día
    </Dialog.Trigger>
    <Dialog.Portal>
      <Dialog.Backdrop className="fixed inset-0 z-50 bg-foreground/30" />
      <Dialog.Viewport className="fixed inset-0 z-50 flex items-center justify-center p-3">
        <Dialog.Popup className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-2xl flex-col overflow-hidden rounded-xl border bg-card shadow-xl">
          <header className="relative border-b p-3 pr-14 sm:px-4">
            <Dialog.Title className="font-semibold">Facturas del día</Dialog.Title>
            <Dialog.Description className="text-sm text-muted-foreground">{fecha}</Dialog.Description>
            <Dialog.Close aria-label="Cerrar" className={buttonVariants({ variant: "ghost", className: "absolute right-2 top-2 size-9 px-0" })}><X aria-hidden="true" /></Dialog.Close>
          </header>
          <div className="min-h-0 overflow-y-auto overscroll-contain p-3 sm:px-4">
            {errorConsulta ? <p role="alert" className="text-sm text-destructive">No se pudieron consultar las fichas tributarias de esta fecha.</p> :
              abierto && <SesionFacturas pedidos={pedidos} />}
          </div>
        </Dialog.Popup>
      </Dialog.Viewport>
    </Dialog.Portal>
  </Dialog.Root>;
}
