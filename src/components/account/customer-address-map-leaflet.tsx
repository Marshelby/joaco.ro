"use client";

import "leaflet/dist/leaflet.css";

import L from "leaflet";
import { LocateFixed, MapPin } from "lucide-react";
import { useEffect, useState } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";

import type { AddressCoordinates } from "@/components/account/customer-address-map";
import { Button } from "@/components/ui/button";
import { DELIVERY_MAP_INITIAL_CENTER, DELIVERY_MAP_INITIAL_ZOOM } from "@/config/delivery-location";

import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x.src,
  iconUrl: markerIcon.src,
  shadowUrl: markerShadow.src,
});

type CustomerAddressMapLeafletProps = AddressCoordinates & {
  onCoordinatesChange: (coordinates: AddressCoordinates) => void;
};

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

function RecenterMap({ center }: { center: Coordinate }) {
  const map = useMap();
  useEffect(() => {
    map.setView([center.latitude, center.longitude], map.getZoom(), { animate: true });
  }, [center, map]);
  return null;
}

export default function CustomerAddressMapLeaflet({ latitude, longitude, onCoordinatesChange }: CustomerAddressMapLeafletProps) {
  const coordinates = { latitude, longitude };
  const hasLocation = hasCoordinates(coordinates);
  const center = hasLocation ? coordinates : DELIVERY_MAP_INITIAL_CENTER;
  const [isLocating, setIsLocating] = useState(false);
  const [geolocationError, setGeolocationError] = useState<string | null>(null);

  function updateCoordinates(nextCoordinates: Coordinate) {
    setGeolocationError(null);
    onCoordinatesChange(nextCoordinates);
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setGeolocationError("Tu navegador no permite obtener la ubicación. Puedes marcarla manualmente en el mapa.");
      return;
    }

    setIsLocating(true);
    setGeolocationError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        updateCoordinates({ latitude: position.coords.latitude, longitude: position.coords.longitude });
        setIsLocating(false);
      },
      () => {
        setGeolocationError("No pudimos acceder a tu ubicación. Puedes marcarla manualmente en el mapa.");
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 60_000 },
    );
  }

  return (
    <section className="space-y-3 sm:col-span-2" aria-labelledby="address-map-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="address-map-title" className="text-sm font-medium text-foreground">Ubicación de entrega</h2>
          <p className="mt-1 text-sm text-muted-foreground">Marca en el mapa el punto exacto de entrega.</p>
        </div>
        <Button type="button" variant="secondary" onClick={useCurrentLocation} disabled={isLocating}>
          <LocateFixed aria-hidden="true" /> {isLocating ? "Obteniendo ubicación..." : "Usar mi ubicación"}
        </Button>
      </div>
      {!hasLocation ? <p className="text-sm text-amber-700 dark:text-amber-300">Esta dirección aún no tiene ubicación marcada.</p> : <p className="flex items-center gap-1.5 text-sm text-primary"><MapPin aria-hidden="true" className="size-4" /> Ubicación marcada</p>}
      {geolocationError ? <p role="alert" className="text-sm text-destructive">{geolocationError}</p> : null}
      <div className="h-80 overflow-hidden rounded-xl border border-border" aria-label="Mapa para marcar la ubicación de entrega">
        <MapContainer center={[center.latitude, center.longitude]} zoom={hasLocation ? 16 : DELIVERY_MAP_INITIAL_ZOOM} scrollWheelZoom className="h-full w-full" aria-label="Mapa de ubicación de entrega">
          <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <MapEvents onCoordinatesChange={updateCoordinates} />
          <RecenterMap center={center} />
          {hasLocation ? <Marker position={[coordinates.latitude, coordinates.longitude]} draggable eventHandlers={{ dragend: (event) => { const position = event.target.getLatLng(); updateCoordinates({ latitude: position.lat, longitude: position.lng }); } }} /> : null}
        </MapContainer>
      </div>
    </section>
  );
}
