"use client";

import "leaflet/dist/leaflet.css";

import L from "leaflet";
import { LocateFixed, MapPin } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";

import type { AddressCoordinates, CustomerAddressMapProps } from "@/components/account/customer-address-map";
import { Button } from "@/components/ui/button";
import { DELIVERY_MAP_INITIAL_CENTER, DELIVERY_MAP_INITIAL_ZOOM } from "@/config/delivery-location";

function locationPin(confirmed: boolean) {
  const color = confirmed ? "#047857" : "#b45309";
  return L.divIcon({
    className: "customer-location-pin",
    iconSize: [40, 52],
    iconAnchor: [20, 52],
    popupAnchor: [0, -48],
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="52" viewBox="0 0 40 52" aria-hidden="true" style="display:block;overflow:visible;filter:drop-shadow(0 2px 3px rgba(0,0,0,.4))"><path d="M20 52C17 44 2 31 2 20a18 18 0 0 1 36 0c0 11-15 24-18 32Z" fill="${color}"/><path d="M20 47C15 38 5 29 5 20a15 15 0 0 1 30 0c0 9-10 18-15 27Z" fill="none" stroke="white" stroke-width="2"/><circle cx="20" cy="20" r="7" fill="white"/><circle cx="20" cy="20" r="3" fill="${color}"/></svg>`,
  });
}

const provisionalPin = locationPin(false);
const confirmedPin = locationPin(true);

type Coordinate = { latitude: number; longitude: number };

function hasCoordinates(coordinates: AddressCoordinates): coordinates is Coordinate {
  const { latitude, longitude } = coordinates;
  return typeof latitude === "number" && typeof longitude === "number" && Number.isFinite(latitude) && Number.isFinite(longitude) && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
}

function MapEvents({ onCoordinatesChange }: { onCoordinatesChange: (coordinates: Coordinate) => void }) {
  useMapEvents({
    click(event) {
      onCoordinatesChange({ latitude: event.latlng.lat, longitude: event.latlng.lng });
    },
  });
  return null;
}

function RecenterMap({ center, searchFocus }: { center: Coordinate; searchFocus: Coordinate | null }) {
  const map = useMap();
  useEffect(() => {
    map.setView([center.latitude, center.longitude], map.getZoom(), { animate: true });
  }, [center, map]);
  useEffect(() => {
    if (searchFocus) map.setView([searchFocus.latitude, searchFocus.longitude], Math.max(map.getZoom(), 17), { animate: true });
  }, [searchFocus, map]);
  return null;
}

export default function CustomerAddressMapLeaflet({ latitude, longitude, onCoordinatesChange, requireConfirmation = false, locationConfirmed = false, onConfirmLocation, renderLocationSearch }: CustomerAddressMapProps) {
  const coordinates = { latitude, longitude };
  const hasLocation = hasCoordinates(coordinates);
  const center = hasLocation ? coordinates : DELIVERY_MAP_INITIAL_CENTER;
  const [isLocating, setIsLocating] = useState(false);
  const [geolocationError, setGeolocationError] = useState<string | null>(null);
  const [searchFocus, setSearchFocus] = useState<Coordinate | null>(null);

  const [locationAccuracy, setLocationAccuracy] = useState<(Coordinate & { meters: number }) | null>(null);
  const locationRequest = useRef(0);
  const requestPending = useRef(false);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      locationRequest.current += 1;
    };
  }, []);
  useEffect(() => {
    // Cambiar la dirección, su receptor de coordenadas o su confirmación invalida respuestas anteriores.
    locationRequest.current += 1;
  }, [latitude, longitude, locationConfirmed, requireConfirmation, onCoordinatesChange]);

  function invalidateLocationRequest() {
    locationRequest.current += 1;
    setGeolocationError(null);
    setLocationAccuracy(null);
  }

  function updateCoordinates(nextCoordinates: Coordinate) {
    // Una selección manual prevalece sobre una solicitud de ubicación pendiente.
    invalidateLocationRequest();
    onCoordinatesChange(nextCoordinates);
  }

  function useCurrentLocation() {
    if (requestPending.current) return;
    if (!navigator.geolocation) {
      setGeolocationError("Tu navegador no admite geolocalización. Marca tu ubicación manualmente en el mapa.");
      return;
    }

    requestPending.current = true;
    setIsLocating(true);
    setGeolocationError(null);
    setLocationAccuracy(null);
    const request = ++locationRequest.current;
    const finishRequest = () => {
      requestPending.current = false;
      if (mounted.current) setIsLocating(false);
      return mounted.current && request === locationRequest.current;
    };
    try {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (!finishRequest()) return;
          const nextCoordinates = { latitude: position.coords.latitude, longitude: position.coords.longitude };
          if (!hasCoordinates(nextCoordinates)) {
            setGeolocationError("La posición recibida no es válida. Marca tu ubicación manualmente en el mapa.");
            return;
          }
          const accuracy = position.coords.accuracy;
          setLocationAccuracy(Number.isFinite(accuracy) && accuracy >= 0 ? { ...nextCoordinates, meters: accuracy } : null);
          onCoordinatesChange(nextCoordinates);
        },
        (error) => {
          if (!finishRequest()) return;
          const messages: Record<number, string> = {
            1: "Permiso de ubicación denegado. Puedes habilitarlo en tu navegador o marcar el punto manualmente.",
            2: "Tu posición no está disponible en este momento. Intenta nuevamente o marca el punto manualmente.",
            3: "Se agotó el tiempo de espera para obtener tu ubicación. Intenta nuevamente o marca el punto manualmente.",
          };
          setGeolocationError(messages[error.code] ?? "No pudimos obtener tu ubicación. Marca el punto manualmente en el mapa.");
        },
        { enableHighAccuracy: true, timeout: 12_000, maximumAge: 0 },
      );
    } catch {
      if (finishRequest()) setGeolocationError("El navegador no pudo iniciar la geolocalización. Marca el punto manualmente en el mapa.");
    }
  }

  return (
    <section className="space-y-3 sm:col-span-2" aria-labelledby="address-map-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="address-map-title" className="text-sm font-medium text-foreground">Ubicación de entrega</h2>
          <p className="mt-1 text-sm text-muted-foreground">Marca en el mapa el punto exacto de entrega.</p>
        </div>
        <Button type="button" variant="secondary" onClick={useCurrentLocation} disabled={isLocating}>
          <LocateFixed aria-hidden="true" /> {isLocating ? "Obteniendo ubicación..." : "Usar mi ubicación actual"}
        </Button>
      </div>
      <div role="status" aria-live="polite" className="space-y-1 text-sm">
        {isLocating && <p className="text-muted-foreground">Buscando tu ubicación… Puedes seguir ajustando el pin manualmente.</p>}
        {locationAccuracy && locationAccuracy.latitude === latitude && locationAccuracy.longitude === longitude && <p className="text-amber-700 dark:text-amber-300">Ubicación aproximada. Precisión informada por el navegador: {locationAccuracy.meters} metros. Revisa y ajusta el pin{requireConfirmation ? " antes de confirmar" : " antes de guardar"}.</p>}
        {!hasLocation ? <p className="text-amber-700 dark:text-amber-300">Esta dirección aún no tiene ubicación marcada. El centro del mapa es solo una referencia.</p> : <>
          <p className={`flex items-center gap-1.5 font-medium ${requireConfirmation && !locationConfirmed ? "text-amber-700 dark:text-amber-300" : "text-primary"}`}><MapPin aria-hidden="true" className="size-4" />{requireConfirmation ? (locationConfirmed ? "Ubicación confirmada" : "Punto provisional: confirma la ubicación antes de guardar.") : "Ubicación marcada"}</p>
          <p className="font-mono text-muted-foreground">Latitud: {coordinates.latitude.toFixed(6)} · Longitud: {coordinates.longitude.toFixed(6)}</p>
        </>}
      </div>
      {requireConfirmation && <Button type="button" disabled={!hasLocation || locationConfirmed || isLocating} onClick={() => { if (hasCoordinates(coordinates)) onConfirmLocation?.(coordinates); }}>Confirmar ubicación</Button>}
      {geolocationError ? <p role="alert" className="text-sm text-destructive">{geolocationError}</p> : null}
      {renderLocationSearch?.((nextCoordinates) => {
        if (!hasCoordinates(nextCoordinates)) return;
        const point = { latitude: nextCoordinates.latitude, longitude: nextCoordinates.longitude };
        updateCoordinates(point);
        setSearchFocus(point);
      })}
      <div className="h-80 overflow-hidden rounded-xl border border-border" aria-label="Mapa para marcar la ubicación de entrega">
        <MapContainer center={[center.latitude, center.longitude]} zoom={hasLocation ? 16 : DELIVERY_MAP_INITIAL_ZOOM} scrollWheelZoom className="h-full w-full" aria-label="Mapa de ubicación de entrega">
          <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <MapEvents onCoordinatesChange={updateCoordinates} />
          <RecenterMap center={center} searchFocus={searchFocus} />
          {hasLocation ? <Marker icon={requireConfirmation && !locationConfirmed ? provisionalPin : confirmedPin} title={requireConfirmation && !locationConfirmed ? "Punto provisional: arrastra para ajustar" : "Ubicación de entrega: arrastra para ajustar"} position={[coordinates.latitude, coordinates.longitude]} draggable eventHandlers={{ dragstart: invalidateLocationRequest, dragend: (event) => { const position = event.target.getLatLng(); updateCoordinates({ latitude: position.lat, longitude: position.lng }); } }} /> : null}
        </MapContainer>
      </div>
    </section>
  );
}
