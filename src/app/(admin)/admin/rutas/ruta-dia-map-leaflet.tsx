"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useRef } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import type { ParadaRuta } from "./ruta-dia-map";

type ParadaUbicada = Omit<ParadaRuta, "detalle"> & { latitude: number; longitude: number };

function Encuadrar({ paradas, seleccionada }: { paradas: ParadaUbicada[]; seleccionada: string | null }) {
  const map = useMap();
  useEffect(() => {
    const encuadrar = () => {
      map.invalidateSize();
      const parada = paradas.find((item) => item.id === seleccionada);
      if (parada) {
        map.setView([parada.latitude, parada.longitude], Math.max(map.getZoom(), 16));
        return;
      }
      map.fitBounds(L.latLngBounds(paradas.map((parada) => [parada.latitude, parada.longitude])), { padding: [35, 35], maxZoom: 16 });
    };
    if (map.getContainer().clientWidth > 0 && map.getContainer().clientHeight > 0) encuadrar();
    // La pestaña puede abrirse después de montar el mapa.
    const observer = new ResizeObserver(() => {
      if (map.getContainer().clientWidth > 0 && map.getContainer().clientHeight > 0) encuadrar();
    });
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map, paradas, seleccionada]);
  return null;
}

export default function RutaDiaMapLeaflet({ paradas, seleccionada, onSeleccionar }: {
  paradas: ParadaUbicada[];
  seleccionada: string | null;
  onSeleccionar: (id: string) => void;
}) {
  const marcadores = useRef(new Map<string, L.Marker>());
  useEffect(() => {
    marcadores.current.forEach((marcador, id) => {
      if (id === seleccionada) marcador.openPopup();
      else marcador.closePopup();
    });
  }, [seleccionada]);

  return <div className="relative z-0 h-full overflow-hidden">
    <MapContainer center={[paradas[0].latitude, paradas[0].longitude]} zoom={13} scrollWheelZoom className="h-full w-full" aria-label="Mapa de paradas numeradas de la ruta">
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <Encuadrar paradas={paradas} seleccionada={seleccionada} />
      {paradas.map((parada) => <Marker key={parada.id} ref={(marcador) => {
        if (marcador) marcadores.current.set(parada.id, marcador);
        else marcadores.current.delete(parada.id);
      }} eventHandlers={{ click: () => onSeleccionar(parada.id) }} position={[parada.latitude, parada.longitude]} title={`${parada.numero}. ${parada.cliente} · ${parada.pedido}`} icon={L.divIcon({
        className: "route-stop-pin",
        iconSize: [40, 40], iconAnchor: [20, 20],
        html: `<span style="display:flex;align-items:center;justify-content:center;width:40px;height:40px;border:2px solid white;border-radius:50%;background:${parada.entregado ? "#15803d" : seleccionada === parada.id ? "#1d4ed8" : "#334155"};color:white;font-size:16px;font-weight:700;box-shadow:0 2px 5px #0006">${parada.numero}${parada.entregado ? "✓" : ""}</span>`,
      })}><Popup><strong>{parada.numero}. {parada.cliente}</strong><br />{parada.ubicacion || "Ubicación del pedido"}<br />Pedido {parada.pedido}</Popup></Marker>)}
    </MapContainer>
  </div>;
}
