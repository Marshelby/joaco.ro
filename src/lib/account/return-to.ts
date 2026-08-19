import { ROUTES } from "@/config/routes";

const destinosCompraPermitidos = [ROUTES.checkout, ROUTES.cart] as const;
const destinosAutenticacionPermitidos = [
  ROUTES.home,
  ROUTES.checkout,
  ROUTES.cart,
  ROUTES.account,
  ROUTES.accountOrders,
] as const;

export type ReturnToCompra = (typeof destinosCompraPermitidos)[number];
export type ReturnToAutenticacion = string;

const rutaAceptarInvitacion = "/aceptar-invitacion";
const tokenInvitacionValido = /^[a-f0-9]{64}$/;

export function obtenerReturnToSeguro(valor: string | undefined): ReturnToCompra | null {
  return destinosCompraPermitidos.includes(valor as ReturnToCompra) ? valor as ReturnToCompra : null;
}

export function obtenerReturnToAutenticacionSeguro(valor: string | undefined): ReturnToAutenticacion | null {
  if (destinosAutenticacionPermitidos.includes(valor as (typeof destinosAutenticacionPermitidos)[number])) return valor as string;
  return obtenerRutaAceptacionInvitacionSegura(valor);
}

export function obtenerTokenInvitacionSeguro(valor: string | undefined) {
  return valor && tokenInvitacionValido.test(valor) ? valor : null;
}

export function hrefAceptarInvitacion(token: string) {
  const tokenSeguro = obtenerTokenInvitacionSeguro(token);
  return tokenSeguro ? `${rutaAceptarInvitacion}?token=${tokenSeguro}` : null;
}

function obtenerRutaAceptacionInvitacionSegura(valor: string | undefined) {
  if (!valor) return null;
  let url: URL;
  try {
    url = new URL(valor, "https://hidro-leufu.invalid");
  } catch {
    return null;
  }
  if (url.origin !== "https://hidro-leufu.invalid" || url.pathname !== rutaAceptarInvitacion || url.searchParams.size !== 1) return null;
  const token = obtenerTokenInvitacionSeguro(url.searchParams.get("token") ?? undefined);
  return token ? hrefAceptarInvitacion(token) : null;
}

export function hrefConReturnTo(ruta: string, returnTo: string | null) {
  return returnTo ? `${ruta}${ruta.includes("?") ? "&" : "?"}returnTo=${encodeURIComponent(returnTo)}` : ruta;
}

export function etiquetaReturnTo(returnTo: ReturnToCompra) {
  return returnTo === ROUTES.checkout ? "Volver a finalizar pedido" : "Volver al carrito";
}
