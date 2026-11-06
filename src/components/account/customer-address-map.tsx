"use client";

import dynamic from "next/dynamic";

export type AddressCoordinates = {
  latitude: number | null;
  longitude: number | null;
};

export type CustomerAddressMapProps = AddressCoordinates & {
  requireConfirmation?: boolean;
  locationConfirmed?: boolean;
  onConfirmLocation?: (coordinates: AddressCoordinates) => void;
  onCoordinatesChange: (coordinates: AddressCoordinates) => void;
};

const CustomerAddressMapLeaflet = dynamic(
  () => import("./customer-address-map-leaflet"),
  {
    ssr: false,
    loading: () => <div className="h-80 animate-pulse rounded-xl border border-border bg-muted" aria-label="Cargando mapa" />,
  },
);

export function CustomerAddressMap(props: CustomerAddressMapProps) {
  return <CustomerAddressMapLeaflet {...props} />;
}
