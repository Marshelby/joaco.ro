"use client";

import dynamic from "next/dynamic";
import { getGoogleMapsLocationUrl } from "@/lib/maps";

export type ParadaRuta = {
  id: string;
  numero: number;
  cliente: string;
  ubicacion: string | null;
  pedido: string;
  latitude: number | null;
  longitude: number | null;
};

const Mapa = dynamic(() => import("./ruta-dia-map-leaflet"), {
  ssr: false,
  loading: () => <div className="h-80 animate-pulse rounded-xl bg-muted" aria-label="Cargando mapa de la ruta" />,
});

export function RutaDiaMap({ paradas }: { paradas: ParadaRuta[] }) {
  const ubicadas = paradas.flatMap((parada) =>
    getGoogleMapsLocationUrl(parada.latitude, parada.longitude)
      ? [{ ...parada, latitude: parada.latitude!, longitude: parada.longitude! }]
      : []);
  const sinUbicacion = paradas.filter((parada) => !getGoogleMapsLocationUrl(parada.latitude, parada.longitude));

  return <div className="space-y-3 rounded-xl border border-border bg-card p-3">
    <h3 className="font-semibold">Mapa de la ruta</h3>
    {ubicadas.length > 0 ? <Mapa paradas={ubicadas} /> : <p className="text-sm text-muted-foreground">No hay paradas con ubicación disponible para mostrar en el mapa.</p>}
    {sinUbicacion.length > 0 ? <ul className="space-y-1 text-sm text-muted-foreground">{sinUbicacion.map((parada) => <li key={parada.id}>Parada {parada.numero} · {parada.cliente} · Pedido {parada.pedido}: sin ubicación comercial válida en el pedido.</li>)}</ul> : null}
  </div>;
}
