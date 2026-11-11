"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CheckCircle2, ChevronDown, GripVertical } from "lucide-react";
import { ordenRutaDiaAction } from "./actions";
import { Button } from "@/components/ui/button";
import { getGoogleMapsLocationUrl } from "@/lib/maps";

export type ParadaRuta = {
  id: string;
  numero: number;
  cliente: string;
  ubicacion: string | null;
  pedido: string;
  latitude: number | null;
  longitude: number | null;
  entregado: boolean;
  fallida: boolean;
  detalle: ReactNode;
};

const Mapa = dynamic(() => import("./ruta-dia-map-leaflet"), {
  ssr: false,
  loading: () => <div className="h-full animate-pulse bg-muted" aria-label="Cargando mapa de la ruta" />,
});

export function RutaDiaMap({ paradas: originales, fecha, cerrada = false, rutaId, versionRuta }: { paradas: ParadaRuta[]; fecha: string; cerrada?: boolean; rutaId?: string; versionRuta?: number }) {
  const [orden, setOrden] = useState(originales.map((p) => p.id));
  const confirmado = useRef(orden);
  const actual = useRef(orden);
  const version = useRef(0);
  const [lista, setLista] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [arrastrada, setArrastrada] = useState<string | null>(null);
  const bloqueo = useRef(false);
  const arrastre = useRef<{ id: string; pointerId: number; y: number; x: number; frame: number } | null>(null);
  const paradas = useMemo(() => {
    const porId = new Map(originales.map((p) => [p.id, p]));
    return orden.flatMap((id, indice) => {
      const parada = porId.get(id);
      return parada ? [{ ...parada, numero: indice + 1 }] : [];
    });
  }, [originales, orden]);

  useEffect(() => {
    let vigente = true;
    ordenRutaDiaAction(fecha, undefined, undefined, rutaId).then((resultado) => {
      if (!vigente) return;
      if (resultado.error || !resultado.orden || resultado.version === undefined) {
        setError(resultado.error ?? "No se pudo recuperar el orden.");
        return;
      }
      const ids = originales.map((p) => p.id);
      const guardados = resultado.orden.filter((id) => ids.includes(id));
      const combinado = [...guardados, ...ids.filter((id) => !guardados.includes(id))];
      confirmado.current = actual.current = combinado;
      version.current = resultado.version;
      setOrden(combinado);
      setLista(true);
    });
    return () => { vigente = false; };
  }, [fecha, originales, rutaId, versionRuta]);

  useEffect(() => () => {
    if (arrastre.current) cancelAnimationFrame(arrastre.current.frame);
  }, []);

  function mover(id: string, destino: number) {
    const nuevo = [...actual.current];
    const origen = nuevo.indexOf(id);
    if (origen < 0 || destino < 0 || destino >= nuevo.length || origen === destino) return;
    nuevo.splice(origen, 1);
    nuevo.splice(destino, 0, id);
    actual.current = nuevo;
    setOrden(nuevo);
  }

  async function guardar() {
    if (cerrada || actual.current.join() === confirmado.current.join()) return;
    bloqueo.current = true;
    setGuardando(true);
    setError(null);
    try {
      const resultado = await ordenRutaDiaAction(fecha, actual.current, version.current, rutaId);
      if (resultado.error || resultado.version === undefined || !resultado.orden) {
        throw new Error(resultado.error ?? "No se pudo confirmar el orden.");
      }
      if (resultado.orden.join() !== actual.current.join()) {
        throw new Error("El servidor no confirmó el orden solicitado. Recarga antes de continuar.");
      }
      confirmado.current = [...resultado.orden];
      version.current = resultado.version;
    } catch (fallo) {
      actual.current = [...confirmado.current];
      setOrden(actual.current);
      setError(`${fallo instanceof Error ? fallo.message : "No se pudo guardar."} Se restauró el último orden confirmado. Recarga antes de volver a ordenar.`);
      setLista(false);
    } finally {
      bloqueo.current = false;
      setGuardando(false);
    }
  }

  function seguirArrastre() {
    const gesto = arrastre.current;
    const contenedor = listado.current;
    if (!gesto || !contenedor) return;
    const limites = contenedor.getBoundingClientRect();
    if (gesto.y < limites.top + 44) contenedor.scrollTop -= 10;
    else if (gesto.y > limites.bottom - 44) contenedor.scrollTop += 10;
    const fila = document.elementFromPoint(gesto.x, gesto.y)?.closest<HTMLElement>("[data-parada]");
    if (fila && contenedor.contains(fila)) {
      const destino = actual.current.indexOf(fila.dataset.parada!);
      const origen = actual.current.indexOf(gesto.id);
      const rect = fila.getBoundingClientRect();
      const centro = rect.top + rect.height / 2;
      if ((destino > origen && gesto.y >= centro) || (destino < origen && gesto.y <= centro)) {
        mover(gesto.id, destino);
      }
    }
    gesto.frame = requestAnimationFrame(seguirArrastre);
  }

  function terminarArrastre(cancelado: boolean) {
    if (!arrastre.current) return;
    cancelAnimationFrame(arrastre.current.frame);
    arrastre.current = null;
    setArrastrada(null);
    if (cancelado) {
      actual.current = [...confirmado.current];
      setOrden(actual.current);
    } else void guardar();
  }

  function abrirUbicacion(parada: ParadaRuta) {
    if (!getGoogleMapsLocationUrl(parada.latitude, parada.longitude)) {
      setAviso(`Pedido ${parada.pedido}: no tiene coordenadas válidas para obtener indicaciones.`);
      return;
    }
    setAviso(null);
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${parada.latitude},${parada.longitude}`)}`, "_blank", "noopener,noreferrer");
  }
  const [seleccionada, setSeleccionada] = useState<string | null>(null);
  const [panelAbierto, setPanelAbierto] = useState(true);
  const listado = useRef<HTMLOListElement>(null);
  const ubicadas = useMemo(() => paradas.flatMap((parada) =>
    getGoogleMapsLocationUrl(parada.latitude, parada.longitude)
      ? [{ ...parada, latitude: parada.latitude!, longitude: parada.longitude! }]
      : []), [paradas]);
  const sinUbicacion = paradas.filter((parada) => !getGoogleMapsLocationUrl(parada.latitude, parada.longitude));

  function seleccionar(id: string) {
    setSeleccionada(id);
    setPanelAbierto(true);
  }

  useEffect(() => {
    if (!panelAbierto || !seleccionada) return;
    const fila = Array.from(listado.current?.children ?? []).find((elemento) => elemento.getAttribute("data-parada") === seleccionada);
    if (fila && listado.current) listado.current.scrollTop = (fila as HTMLElement).offsetTop - listado.current.offsetTop;
  }, [seleccionada, panelAbierto]);

  return <div className="min-w-0 overflow-hidden rounded-xl border border-border bg-card">
    <h3 className="border-b border-border px-3 py-3 font-semibold">Mapa de la ruta</h3>
    <p className="flex flex-wrap gap-x-4 gap-y-1 px-3 pt-3 text-xs" aria-live="polite"><span>Entregados: {paradas.filter(p => p.entregado).length}</span><span className="text-destructive">Entrega fallida: {paradas.filter(p => p.fallida).length}</span><span>Pendientes: {paradas.filter(p => !p.entregado && !p.fallida).length}</span></p>
    <div className="space-y-1 px-3 py-2 text-sm" aria-live="polite">
      <p>{cerrada ? "Orden bloqueado: ruta en reparto o cerrada." : guardando ? "Guardando orden…" : lista ? "Arrastra el asa para ordenar las paradas. También puedes usar las flechas del teclado." : "Reordenamiento no disponible hasta recuperar el orden guardado."}</p>
      {error ? <p role="alert" className="text-destructive">{error}</p> : null}
      {aviso ? <p role="alert">{aviso}</p> : null}
    </div>
    <div className="flex flex-col lg:h-[38rem] lg:flex-row">
      <div className="relative z-0 h-[max(20rem,48dvh)] min-h-80 w-full min-w-0 flex-none lg:h-full lg:min-h-0 lg:w-auto lg:flex-1">
        {ubicadas.length > 0 ? <Mapa paradas={ubicadas} seleccionada={seleccionada} onSeleccionar={seleccionar} /> : <p className="p-4 text-sm text-muted-foreground">No hay paradas con ubicación disponible para mostrar en el mapa.</p>}
      </div>
      <aside className={`flex w-full min-h-0 min-w-0 shrink-0 flex-col border-t border-border lg:border-t-0 lg:border-l ${panelAbierto ? "lg:w-96" : "lg:w-44"}`} aria-label="Paradas de la ruta">
        <button type="button" className="flex min-h-12 w-full items-center justify-between gap-3 p-3 text-sm font-semibold hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring" aria-expanded={panelAbierto} aria-controls="listado-paradas-ruta" onClick={() => setPanelAbierto((abierto) => !abierto)}>
          Paradas ({paradas.length})<ChevronDown className={`size-4 shrink-0 transition-transform ${panelAbierto ? "rotate-180" : ""}`} aria-hidden="true" />
        </button>
        <div id="listado-paradas-ruta" hidden={!panelAbierto} className="min-h-0 flex-1 overflow-hidden">
          <ol ref={listado} className="relative max-h-[36dvh] space-y-2 overflow-y-auto overscroll-contain p-2 lg:h-full lg:max-h-none"
            onPointerMove={(evento) => {
              if (arrastre.current?.pointerId === evento.pointerId) {
                arrastre.current.x = evento.clientX;
                arrastre.current.y = evento.clientY;
              }
            }}
            onPointerUp={(evento) => {
              if (arrastre.current?.pointerId === evento.pointerId) terminarArrastre(false);
            }}
            onPointerCancel={(evento) => {
              if (arrastre.current?.pointerId === evento.pointerId) terminarArrastre(true);
            }}
            onLostPointerCapture={(evento) => {
              if (arrastre.current?.pointerId === evento.pointerId) terminarArrastre(true);
            }}>
            {paradas.map((parada) => {
              const activa = seleccionada === parada.id;
              return <li key={parada.id} data-parada={parada.id} className={`rounded-lg border ${activa ? "ring-2 ring-primary ring-inset" : ""} ${parada.fallida ? "border-destructive/40 bg-destructive/5 text-destructive" : parada.entregado ? "border-green-600/40 bg-green-50 text-green-950 dark:bg-green-950/30 dark:text-green-100" : "border-border bg-card"}`}>
                <div className="flex items-center">
                <button type="button" aria-label={`Mover parada ${parada.numero}: ${parada.cliente}`} disabled={cerrada || !lista || guardando}
                  className={`min-h-12 min-w-11 shrink-0 touch-none select-none rounded-lg focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-40 ${arrastrada === parada.id ? "cursor-grabbing bg-muted" : "cursor-grab"}`}
                  onPointerDown={(evento) => {
                    if (cerrada || bloqueo.current || !lista || !evento.isPrimary || evento.button !== 0 || arrastre.current || !listado.current) return;
                    evento.preventDefault();
                    // La captura debe permanecer en un nodo que no se mueve al ordenar.
                    listado.current.setPointerCapture(evento.pointerId);
                    setArrastrada(parada.id);
                    arrastre.current = { id: parada.id, pointerId: evento.pointerId, x: evento.clientX, y: evento.clientY, frame: 0 };
                    seguirArrastre();
                  }}
                  onKeyDown={(evento) => {
                    if (cerrada || bloqueo.current || arrastre.current || !["ArrowUp", "ArrowDown"].includes(evento.key)) return;
                    evento.preventDefault();
                    mover(parada.id, actual.current.indexOf(parada.id) + (evento.key === "ArrowUp" ? -1 : 1));
                    void guardar();
                  }}><GripVertical className="mx-auto size-5" aria-hidden="true" /></button>
                <button type="button" aria-expanded={activa} aria-controls={`detalle-parada-${parada.id}`} onClick={() => activa ? setSeleccionada(null) : seleccionar(parada.id)} className="flex min-h-14 min-w-0 flex-1 items-center gap-2 rounded-lg p-3 text-left focus-visible:outline-2 focus-visible:outline-ring">
                  <span className={`flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${parada.fallida ? "bg-destructive text-white" : parada.entregado ? "bg-green-700 text-white" : "bg-muted text-foreground"}`}>{parada.numero}</span>
                  <span className="min-w-0 flex-1"><span className="block break-words text-sm font-semibold">{parada.cliente}</span><span className="block break-words text-xs opacity-80">{parada.ubicacion || "Sin ubicación comercial registrada"}</span></span>
                  {parada.fallida ? <span className="shrink-0 text-xs font-semibold">Entrega fallida</span> : null}
                  {parada.entregado ? <CheckCircle2 className="size-4 shrink-0" aria-label="Entregado" /> : null}
                  <ChevronDown className={`size-4 shrink-0 transition-transform ${activa ? "rotate-180" : ""}`} aria-hidden="true" />
                </button>
                </div>
                <div id={`detalle-parada-${parada.id}`} hidden={!activa}>{parada.detalle}
                  <div className="px-3 pb-3"><Button type="button" variant="outline" onClick={() => abrirUbicacion(parada)}>Ubicación</Button></div>
                </div>
              </li>;
            })}
          </ol>
        </div>
      </aside>
    </div>
    <div className="space-y-2 border-t border-border p-3">
      <p className="text-xs text-muted-foreground">Ubicación abre indicaciones en Google Maps con las coordenadas del pedido.</p>
      {sinUbicacion.length > 0 ? <ul className="space-y-1 text-sm text-muted-foreground">{sinUbicacion.map((parada) => <li key={parada.id}>Parada {parada.numero} · {parada.cliente} · Pedido {parada.pedido}: sin ubicación comercial válida en el pedido.</li>)}</ul> : null}
    </div>
  </div>;
}
