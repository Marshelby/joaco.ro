"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";

export type AddressCoordinates = {
  latitude: number | null;
  longitude: number | null;
};

export type CustomerAddressMapProps = AddressCoordinates & {
  renderLocationSearch?: (onSelect: (coordinates: { latitude: number; longitude: number }) => void) => ReactNode;
  compact?: boolean;
  requireConfirmation?: boolean;
  locationConfirmed?: boolean;
  onConfirmLocation?: (coordinates: AddressCoordinates) => void;
  onCoordinatesChange: (coordinates: AddressCoordinates) => void;
};

const CustomerAddressMapLeaflet = dynamic(
  () => import("./customer-address-map-leaflet"),
  {
    ssr: false,
    loading: () => <div className="h-[var(--address-map-height,20rem)] animate-pulse rounded-xl border border-border bg-muted" aria-label="Cargando mapa" />,
  },
);

export function CustomerAddressMap(props: CustomerAddressMapProps) {
  return props.compact
    ? <div className="[--address-map-height:12rem]"><CustomerAddressMapLeaflet {...props} /></div>
    : <CustomerAddressMapLeaflet {...props} />;
}
