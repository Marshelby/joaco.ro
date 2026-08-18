import { getClosedPresentationKind } from "@/lib/cart-quantity";

export const PREPARACION_ESTADOS = ["pendiente", "completa", "incompleta"] as const;

export type PreparacionEstado = (typeof PREPARACION_ESTADOS)[number];

export const MODOS_CANTIDAD_SNAPSHOT = [
  "kg_fraccionable",
  "presentacion_cerrada",
  "unidad",
] as const;

export type ModoCantidadSnapshot = (typeof MODOS_CANTIDAD_SNAPSHOT)[number];

export function resolverModoCantidadPreparacion({
  modoCantidadSnapshot,
  unidad,
  nombrePresentacion,
}: {
  modoCantidadSnapshot: ModoCantidadSnapshot | null;
  unidad: string;
  nombrePresentacion: string | null;
}): ModoCantidadSnapshot {
  if (modoCantidadSnapshot) return modoCantidadSnapshot;

  const formatoCerrado = nombrePresentacion ? getClosedPresentationKind(nombrePresentacion) : null;
  if (formatoCerrado) return "presentacion_cerrada";
  return unidad.toUpperCase() === "KG" ? "kg_fraccionable" : "unidad";
}
