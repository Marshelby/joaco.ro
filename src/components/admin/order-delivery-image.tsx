"use client";

import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { useEffect, useId, useState } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import type { prepararGuiaEntrega } from "@/lib/admin/guia-entrega";
import { formatCLP } from "@/lib/formatters";

type Guia = NonNullable<ReturnType<typeof prepararGuiaEntrega>>;

function crearPng(guia: Guia, conPrecios: boolean): Promise<Blob> {
  const canvas = document.createElement("canvas");
  const contexto = canvas.getContext("2d");
  if (!contexto) throw new Error("Canvas no disponible");
  const ctx = contexto;

  const ancho = 800;
  const margen = 32;
  const derecha = ancho - margen;
  const verde = "#146349";
  const oscuro = "#172b25";
  const secundario = "#465e55";
  const dibujar: (() => void)[] = [];
  let y = 32;

  function rectangulo(x: number, top: number, width: number, height: number, color: string) {
    dibujar.push(() => {
      ctx.fillStyle = color;
      ctx.fillRect(x, top, width, height);
    });
  }

  function texto(valor: string, x: number, top: number, anchoMax: number, tam: number, peso: number, color: string) {
    const fuente = `${peso} ${tam}px system-ui, sans-serif`;
    ctx.font = fuente;
    const lineas: string[] = [];
    let linea = "";
    for (const palabra of valor.trim().split(/\s+/u)) {
      const candidata = linea ? `${linea} ${palabra}` : palabra;
      if (ctx.measureText(candidata).width <= anchoMax) {
        linea = candidata;
        continue;
      }
      if (linea) lineas.push(linea);
      linea = "";
      for (const caracter of palabra) {
        if (linea && ctx.measureText(linea + caracter).width > anchoMax) {
          lineas.push(linea);
          linea = "";
        }
        linea += caracter;
      }
    }
    lineas.push(linea);
    const interlineado = Math.ceil(tam * 1.3);
    dibujar.push(() => {
      ctx.font = fuente;
      ctx.fillStyle = color;
      lineas.forEach((contenido, indice) => ctx.fillText(contenido, x, top + indice * interlineado));
    });
    return lineas.length * interlineado;
  }

  rectangulo(0, 0, ancho, 8, verde);
  y += texto("HIDRO LEUFÚ", margen, y, derecha - margen, 20, 750, verde) + 6;
  y += texto("Guía de entrega", margen, y, derecha - margen, 37, 750, oscuro) + 14;
  y += texto(guia.destinatario, margen, y, derecha - margen, 26, 700, oscuro) + 6;
  y += texto(`Pedido ${guia.numero}`, margen, y, derecha - margen, 20, 600, secundario);
  y += texto(`Entrega confirmada · ${guia.fecha} · Santiago`, margen, y, derecha - margen, 19, 500, secundario) + 22;

  const desglose = conPrecios && guia.productos.some(producto => producto.importe != null);
  const columnas = desglose ? [32, 389, 520, 654, derecha] : [32, 448, 610, derecha];
  const encabezados = desglose ? ["Producto", "Solicitado", "Entregado", "Importe"] : ["Producto", "Solicitado", "Entregado"];
  rectangulo(margen - 10, y, derecha - margen + 20, 40, "#e7f3ed");
  encabezados.forEach((titulo, i) => texto(titulo, columnas[i], y + 9, columnas[i + 1] - columnas[i], 17, 700, verde));
  y += 40;

  for (const producto of guia.productos) {
    const top = y + 10;
    const anchoNombre = columnas[1] - margen - 14;
    let altoNombre = texto(producto.nombre, margen, top, anchoNombre, 19, 650, oscuro);
    if (producto.presentacion) {
      altoNombre += texto(producto.presentacion, margen, top + altoNombre, anchoNombre, 16, 450, secundario);
    }
    const valores = [producto.solicitada, producto.entregada];
    if (desglose) valores.push(producto.importe == null ? "Sin registro" : formatCLP(producto.importe));
    const altos = valores.map((valor, i) => texto(valor, columnas[i + 1], top, columnas[i + 2] - columnas[i + 1] - 8, 17, 550, oscuro));
    y = top + Math.max(altoNombre, ...altos) + 10;
    rectangulo(margen, y, derecha - margen, 1, "#dce8e2");
  }
  if (!guia.productos.length) {
    y += 12;
    y += texto("Sin productos registrados", margen, y, derecha - margen, 17, 500, secundario);
  }

  if (conPrecios && guia.total != null) {
    y += 16;
    if (!desglose || guia.productos.some(producto => producto.importe == null)) {
      const aviso = desglose ? "Desglose parcial · Faltan importes definitivos" : "Desglose definitivo no disponible";
      y += texto(aviso, margen, y, derecha - margen, 17, 500, secundario) + 8;
    }
    y += texto(`Total definitivo · ${formatCLP(guia.total)}`, margen, y, derecha - margen, 25, 750, verde);
  }

  const alto = y + margen;
  // Reducir la resolución de listas extensas para respetar los límites de canvas en móviles.
  const escala = Math.min(1, 16384 / alto, Math.sqrt(15_000_000 / (ancho * alto)));
  canvas.width = Math.floor(ancho * escala);
  canvas.height = Math.floor(alto * escala);
  ctx.scale(escala, escala);
  ctx.textBaseline = "top";
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, ancho, alto);
  dibujar.forEach(pintar => pintar());

  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob);
      else reject(new Error("PNG no disponible"));
    }, "image/png");
  });
}

function VistaPrevia({ guia, conPrecios }: { guia: Guia; conPrecios: boolean }) {
  const [imagen, setImagen] = useState<{ guia: Guia; url: string | null } | null>(null);

  useEffect(() => {
    let activa = true;
    let urlCreada: string | undefined;
    void Promise.resolve().then(() => crearPng(guia, conPrecios)).then(blob => {
      if (!activa) return;
      urlCreada = URL.createObjectURL(blob);
      setImagen({ guia, url: urlCreada });
    }).catch(() => {
      if (activa) setImagen({ guia, url: null });
    });
    return () => {
      activa = false;
      if (urlCreada) URL.revokeObjectURL(urlCreada);
    };
  }, [guia, conPrecios]);

  if (imagen?.guia !== guia) return <p role="status" className="p-4 text-sm">Generando vista previa…</p>;
  const { url } = imagen;
  if (!url) return <p role="alert" className="p-4 text-sm">No se pudo generar el PNG. Cierra la ventana e inténtalo de nuevo.</p>;

  return <>
    <div className="min-h-0 overflow-auto overscroll-contain bg-muted p-2 sm:p-3">
      {/* El mismo archivo PNG se usa para la vista previa y la descarga. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={`Vista previa de la guía del pedido ${guia.numero}`} className="mx-auto h-auto w-full min-w-[28rem] max-w-none rounded-sm" />
    </div>
    <footer className="flex shrink-0 justify-end border-t border-border p-3">
      <a className={buttonVariants()} href={url} download={`hidro-leufu-${guia.numero.replace(/[^a-z0-9_-]/gi, "-")}.png`}>Descargar PNG</a>
    </footer>
  </>;
}

export function OrderDeliveryImage(props: { guia: Guia } | { pedidoId: string }) {
  const grupo = useId();
  const [open, setOpen] = useState(false);
  const [conPrecios, setConPrecios] = useState(false);

  const pedidoId = "pedidoId" in props ? props.pedidoId : null;
  const [carga, setCarga] = useState<{ guia: Guia | null } | null>(null);
  const guia = "guia" in props ? props.guia : carga?.guia;

  useEffect(() => {
    if (!open || !pedidoId) return;
    const controlador = new AbortController();
    async function cargar(id: string) {
      try {
        const respuesta = await fetch(`/api/admin/pedidos/${encodeURIComponent(id)}/guia-entrega`, {
          signal: controlador.signal,
          cache: "no-store",
          redirect: "error",
        });
        if (!respuesta.ok) throw new Error("Guía no disponible");
        const guia: Guia | null = await respuesta.json();
        if (!controlador.signal.aborted) setCarga({ guia });
      } catch {
        if (!controlador.signal.aborted) setCarga({ guia: null });
      }
    }
    void cargar(pedidoId);
    return () => controlador.abort();
  }, [open, pedidoId]);

  return <Dialog.Root open={open} onOpenChange={abierto => {
    setOpen(abierto);
    if (!abierto) {
      setConPrecios(false);
      setCarga(null);
    }
  }}>
    <Dialog.Trigger render={<Button variant="secondary" className="h-auto min-h-11 max-w-full shrink whitespace-normal px-3 py-1" />}>Crear imagen del pedido</Dialog.Trigger>
    <Dialog.Portal>
      <Dialog.Backdrop className="fixed inset-0 z-60 bg-black/45" />
      <Dialog.Viewport className="fixed inset-0 z-60 flex items-center justify-center p-2 sm:p-4">
        <Dialog.Popup className="flex max-h-[calc(100dvh-1rem)] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-border bg-background shadow-xl outline-none sm:max-h-[calc(100dvh-2rem)]">
          <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-1">
            <Dialog.Title className="text-sm font-semibold">Crear imagen del pedido</Dialog.Title>
            <Dialog.Close render={<Button variant="ghost" className="size-11 p-0" />} aria-label="Cerrar">
              <X aria-hidden="true" />
            </Dialog.Close>
          </header>
          {guia && <fieldset className="flex shrink-0 flex-wrap gap-x-4 px-3">
            <legend className="sr-only">Importes de la guía</legend>
            <label className="flex min-h-11 items-center gap-2 text-sm"><input type="radio" name={grupo} checked={!conPrecios} onChange={() => setConPrecios(false)} />Sin precios</label>
            <label className="flex min-h-11 items-center gap-2 text-sm"><input type="radio" name={grupo} checked={conPrecios} onChange={() => setConPrecios(true)} />Con precios</label>
          </fieldset>}
          {open && !guia && (carga
            ? <p role="alert" className="p-4 text-sm">No se pudo cargar la guía de este pedido. Cierra la ventana e inténtalo de nuevo.</p>
            : <p role="status" className="p-4 text-sm">Cargando datos de la entrega…</p>)}
          {open && guia && (conPrecios && guia.total == null
            ? <p role="status" className="border-t border-border p-4 text-sm">El total definitivo no está disponible. La guía se puede descargar sin precios.</p>
            : <VistaPrevia key={String(conPrecios)} guia={guia} conPrecios={conPrecios} />)}
        </Dialog.Popup>
      </Dialog.Viewport>
    </Dialog.Portal>
  </Dialog.Root>;
}
