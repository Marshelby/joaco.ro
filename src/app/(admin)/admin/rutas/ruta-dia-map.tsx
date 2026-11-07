"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CheckCircle2, ChevronDown } from "lucide-react";
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
  detalle: ReactNode;
};

const Mapa = dynamic(() => import("./ruta-dia-map-leaflet"), {
  ssr: false,
  loading: () => <div className="h-full animate-pulse bg-muted" aria-label="Cargando mapa de la ruta" />,
});

export function RutaDiaMap({ paradas }: { paradas: ParadaRuta[] }) {
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

  return <div className="overflow-hidden rounded-xl border border-border bg-card">
    <h3 className="border-b border-border px-3 py-3 font-semibold">Mapa de la ruta</h3>
    <div className="flex flex-col lg:h-[38rem] lg:flex-row">
      <div className="relative z-0 h-[max(18rem,42dvh)] min-w-0 flex-1 lg:h-full">
        {ubicadas.length > 0 ? <Mapa paradas={ubicadas} seleccionada={seleccionada} onSeleccionar={seleccionar} /> : <p className="p-4 text-sm text-muted-foreground">No hay paradas con ubicación disponible para mostrar en el mapa.</p>}
      </div>
      <aside className={`flex min-h-0 flex-col border-t border-border lg:border-t-0 lg:border-l ${panelAbierto ? "lg:w-96" : "lg:w-44"}`} aria-label="Paradas de la ruta">
        <button type="button" className="flex min-h-12 w-full items-center justify-between gap-3 p-3 text-sm font-semibold hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring" aria-expanded={panelAbierto} aria-controls="listado-paradas-ruta" onClick={() => setPanelAbierto((abierto) => !abierto)}>
          Paradas ({paradas.length})<ChevronDown className={`size-4 shrink-0 transition-transform ${panelAbierto ? "rotate-180" : ""}`} aria-hidden="true" />
        </button>
        <div id="listado-paradas-ruta" hidden={!panelAbierto} className="min-h-0 flex-1 overflow-hidden">
          <ol ref={listado} className="relative max-h-[36dvh] space-y-2 overflow-y-auto overscroll-contain p-2 lg:h-full lg:max-h-none">
            {paradas.map((parada) => {
              const activa = seleccionada === parada.id;
              return <li key={parada.id} data-parada={parada.id} className={`rounded-lg border ${activa ? "ring-2 ring-primary ring-inset" : ""} ${parada.entregado ? "border-green-600/40 bg-green-50 text-green-950 dark:bg-green-950/30 dark:text-green-100" : "border-border bg-card"}`}>
                <button type="button" aria-expanded={activa} aria-controls={`detalle-parada-${parada.id}`} onClick={() => activa ? setSeleccionada(null) : seleccionar(parada.id)} className="flex min-h-14 w-full items-center gap-2 rounded-lg p-3 text-left focus-visible:outline-2 focus-visible:outline-ring">
                  <span className={`flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${parada.entregado ? "bg-green-700 text-white" : "bg-muted text-foreground"}`}>{parada.numero}</span>
                  <span className="min-w-0 flex-1"><span className="block break-words text-sm font-semibold">{parada.cliente}</span><span className="block break-words text-xs opacity-80">{parada.ubicacion || "Sin ubicación comercial registrada"}</span></span>
                  {parada.entregado ? <CheckCircle2 className="size-4 shrink-0" aria-label="Entregado" /> : null}
                  <ChevronDown className={`size-4 shrink-0 transition-transform ${activa ? "rotate-180" : ""}`} aria-hidden="true" />
                </button>
                <div id={`detalle-parada-${parada.id}`} hidden={!activa}>{parada.detalle}</div>
              </li>;
            })}
          </ol>
        </div>
      </aside>
    </div>
    <div className="space-y-2 border-t border-border p-3">
      <p className="text-xs text-muted-foreground">Acciones disponibles próximamente.</p>
      {sinUbicacion.length > 0 ? <ul className="space-y-1 text-sm text-muted-foreground">{sinUbicacion.map((parada) => <li key={parada.id}>Parada {parada.numero} · {parada.cliente} · Pedido {parada.pedido}: sin ubicación comercial válida en el pedido.</li>)}</ul> : null}
    </div>
  </div>;
}
