import type { CartItem } from "@/types/cart";

type CartQuantityItem = Pick<
  CartItem,
  "cantidadPresentacion" | "unidad" | "presentacionNombre"
>;

const CLOSED_FORMAT_PATTERN = /\b(saco|malla|caja|paquete|docena)\b/;

function normalizePresentationName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-CL");
}

export function getClosedPresentationKind(presentationName: string) {
  const normalizedName = normalizePresentationName(presentationName);
  return normalizedName.match(CLOSED_FORMAT_PATTERN)?.[1] ?? null;
}

export function isFractionalKgItem(item: CartQuantityItem) {
  return item.unidad.toUpperCase() === "KG"
    && item.cantidadPresentacion === 1
    && !getClosedPresentationKind(item.presentacionNombre);
}

export function isValidCartQuantity(item: CartQuantityItem, cantidad: number) {
  if (!Number.isFinite(cantidad)) return false;
  if (!isFractionalKgItem(item)) return Number.isInteger(cantidad) && cantidad > 0;

  const halfKiloSteps = cantidad * 2;
  return cantidad >= 0.5
    && cantidad <= 10
    && Number.isInteger(halfKiloSteps);
}

export function getCartQuantityStep(item: CartQuantityItem) {
  return isFractionalKgItem(item) ? 0.5 : 1;
}

export function getCartQuantityMinimum(item: CartQuantityItem) {
  return isFractionalKgItem(item) ? 0.5 : 1;
}

export function getCartQuantityMaximum(item: CartQuantityItem) {
  return isFractionalKgItem(item) ? 10 : undefined;
}

export function formatCartQuantity(item: CartQuantityItem, cantidad: number) {
  return isFractionalKgItem(item) ? `${cantidad} kg` : String(cantidad);
}

export function getSubtotalParaCantidad(cantidad: number, precioFinalReferencia: number) {
  return Math.round(cantidad * precioFinalReferencia);
}

export function getCartLineSubtotal(item: Pick<CartItem, "cantidad" | "precioFinalReferencia">) {
  return getSubtotalParaCantidad(item.cantidad, item.precioFinalReferencia);
}
