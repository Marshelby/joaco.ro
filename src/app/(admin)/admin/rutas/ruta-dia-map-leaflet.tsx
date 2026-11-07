"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import type { ParadaRuta } from "./ruta-dia-map";

type ParadaUbicada = ParadaRuta & { latitude: number; longitude: number };

function Encuadrar({ paradas }: { paradas: ParadaUbicada[] }) {
  const map = useMap();
  useEffect(() => {
    const encuadrar = () => {
      map.invalidateSize();
      map.fitBounds(L.latLngBounds(paradas.map((parada) => [parada.latitude, parada.longitude])), { padding: [35, 35], maxZoom: 16 });
    };
    if (map.getContainer().clientWidth > 0 && map.getContainer().clientHeight > 0) encuadrar();
    // La pestaña puede abrirse después de montar el mapa.
    const observer = new ResizeObserver(() => {
      if (map.getContainer().clientWidth > 0 && map.getContainer().clientHeight > 0) encuadrar();
    });
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map, paradas]);
  return null;
}

export default function RutaDiaMapLeaflet({ paradas }: { paradas: ParadaUbicada[] }) {
  return <div className="relative z-0 h-80 overflow-hidden rounded-lg border border-border">
    <MapContainer center={[paradas[0].latitude, paradas[0].longitude]} zoom={13} scrollWheelZoom className="h-full w-full" aria-label="Mapa de paradas numeradas de la ruta">
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <Encuadrar paradas={paradas} />
      {paradas.map((parada) => <Marker key={parada.id} position={[parada.latitude, parada.longitude]} title={`${parada.numero}. ${parada.cliente} · ${parada.pedido}`} icon={L.divIcon({
        className: "route-stop-pin",
        iconSize: [36, 36], iconAnchor: [18, 18],
        html: `<span style="display:flex;align-items:center;justify-content:center;width:36px;height:36px;border:2px solid white;border-radius:50%;background:#047857;color:white;font-size:16px;font-weight:700;box-shadow:0 2px 5px #0006">${parada.numero}</span>`,
      })}><Popup><strong>{parada.numero}. {parada.cliente}</strong><br />{parada.ubicacion || "Ubicación del pedido"}<br />Pedido {parada.pedido}</Popup></Marker>)}
    </MapContainer>
  </div>;
}
