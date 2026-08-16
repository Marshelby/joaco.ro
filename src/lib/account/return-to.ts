import { ROUTES } from "@/config/routes";

const destinosPermitidos = [ROUTES.checkout, ROUTES.cart] as const;

export type ReturnToCompra = (typeof destinosPermitidos)[number];

export function obtenerReturnToSeguro(valor: string | undefined): ReturnToCompra | null {
  return destinosPermitidos.includes(valor as ReturnToCompra) ? valor as ReturnToCompra : null;
}

export function hrefConReturnTo(ruta: string, returnTo: ReturnToCompra | null) {
  return returnTo ? `${ruta}?returnTo=${encodeURIComponent(returnTo)}` : ruta;
}

export function etiquetaReturnTo(returnTo: ReturnToCompra) {
  return returnTo === ROUTES.checkout ? "Volver a finalizar pedido" : "Volver al carrito";
}
