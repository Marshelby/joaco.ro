import type { CartItem } from "@/types/cart";

type CartQuantityItem = Pick<
  CartItem,
  "cantidadPresentacion" | "unidad" | "presentacionNombre"
>;

export const KG_QUANTITY_STEP = 0.1;
export const KG_QUANTITY_INPUT_STEP = 0.001;

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
  return item.unidad.trim().toUpperCase() === "KG"
    && item.cantidadPresentacion === 1
    && !/(saco|malla|caja|paquete|docena)/i.test(item.presentacionNombre);
}

export function isValidCartQuantity(item: CartQuantityItem, cantidad: number) {
  if (!Number.isFinite(cantidad)) return false;
  if (!isFractionalKgItem(item)) return Number.isInteger(cantidad) && cantidad > 0;

  return cantidad >= getCartQuantityMinimum(item)
    && cantidad <= 10
    && hasQuantityPrecision(cantidad);
}

export function hasQuantityPrecision(cantidad: number) {
  return Number.isFinite(cantidad) && cantidad === roundQuantity(cantidad);
}

export function roundQuantity(cantidad: number) {
  return Math.round(cantidad * 1000) / 1000;
}

function getCartQuantityStep(item: CartQuantityItem) {
  return isFractionalKgItem(item) ? KG_QUANTITY_STEP : 1;
}

export function getCartQuantityInputStep(item: CartQuantityItem) {
  return isFractionalKgItem(item) ? KG_QUANTITY_INPUT_STEP : 1;
}

export function adjustCartQuantity(item: CartQuantityItem, cantidad: number, direction: -1 | 1) {
  const next = cantidad + direction * getCartQuantityStep(item);
  return isFractionalKgItem(item) ? roundQuantity(next) : next;
}

export function getCartQuantityMinimum(item: CartQuantityItem) {
  return isFractionalKgItem(item) ? 0.1 : 1;
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
