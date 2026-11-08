"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useRef } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import type { ParadaRuta } from "./ruta-dia-map";
import styles from "./ruta-dia-map.module.css";

type ParadaUbicada = Omit<ParadaRuta, "detalle"> & { latitude: number; longitude: number };

function Encuadrar({ paradas, seleccionada }: { paradas: ParadaUbicada[]; seleccionada: string | null }) {
  const map = useMap();
  useEffect(() => {
    const encuadrar = () => {
      map.invalidateSize({ pan: false });
      const parada = paradas.find((item) => item.id === seleccionada);
      if (parada) {
        map.setView([parada.latitude, parada.longitude], 14);
        return;
      }
      map.fitBounds(L.latLngBounds(paradas.map((parada) => [parada.latitude, parada.longitude])), { padding: [35, 35], maxZoom: 16 });
    };
    let frame = 0;
    const actualizar = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (map.getContainer().clientWidth > 0 && map.getContainer().clientHeight > 0) encuadrar();
      });
    };
    actualizar();
    // La pestaña puede abrirse después de montar el mapa.
    const observer = new ResizeObserver(actualizar);
    observer.observe(map.getContainer());
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
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

  return <div className="relative z-0 h-full w-full min-w-0 overflow-hidden">
    <MapContainer center={[paradas[0].latitude, paradas[0].longitude]} zoom={13} scrollWheelZoom className="h-full w-full" aria-label="Mapa de paradas numeradas de la ruta">
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <Encuadrar paradas={paradas} seleccionada={seleccionada} />
      {paradas.map((parada) => <Marker key={parada.id} ref={(marcador) => {
        if (marcador) marcadores.current.set(parada.id, marcador);
        else marcadores.current.delete(parada.id);
      }} eventHandlers={{ click: () => onSeleccionar(parada.id) }} position={[parada.latitude, parada.longitude]} title={`${parada.numero}. ${parada.cliente} · ${parada.pedido}`} icon={L.divIcon({
        className: "route-stop-pin",
        iconSize: [40, 40], iconAnchor: [20, 20],
        html: `<span style="display:flex;align-items:center;justify-content:center;width:40px;height:40px;border:2px solid white;border-radius:50%;background:${parada.fallida ? "#b91c1c" : parada.entregado ? "#15803d" : seleccionada === parada.id ? "#1d4ed8" : "#334155"};color:white;font-size:16px;font-weight:700;box-shadow:0 2px 5px #0006">${parada.numero}${parada.fallida ? "×" : parada.entregado ? "✓" : ""}</span>`,
      })}><Popup className={styles.popup} minWidth={160} maxWidth={220} autoPan={false}>
        <div className={styles.heading}>
          <span className={styles.number}>{parada.numero}</span>
          <div className={styles.customer}>
            <span className={styles.eyebrow}>Hidro Leufú · Ruta del día</span>
            <strong className={styles.name}>{parada.cliente}</strong>
          </div>
        </div>
        <div className={styles.location}>
          <span className={styles.label}>Ubicación comercial</span>
          <span>{parada.ubicacion || "Sin ubicación comercial registrada"}</span>
        </div>
        <div className={styles.order}>Pedido {parada.pedido} · {parada.fallida ? "Entrega fallida" : parada.entregado ? "Entregado" : "Pendiente"}</div>
      </Popup></Marker>)}
    </MapContainer>
  </div>;
}
