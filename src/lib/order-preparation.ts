import { DELIVERY_TIME_ZONE } from "@/config/delivery-schedule";
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

// Orientación de interfaz; las RPC vuelven a validar con el reloj de PostgreSQL.
export function obtenerPermisoTemporalPreparacion(fechaEntrega: string | null, momento = new Date()) {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: DELIVERY_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(momento);
  const parte = (tipo: Intl.DateTimeFormatPartTypes) => partes.find((p) => p.type === tipo)?.value ?? "";
  const hoy = `${parte("year")}-${parte("month")}-${parte("day")}`;
  const permitida = fechaEntrega === hoy;
  const mensaje = permitida
    ? "Fecha habilitada para preparar hoy (America/Santiago). Requiere un pedido confirmado o en preparación."
    : !fechaEntrega
      ? "Preparación bloqueada: el pedido no tiene fecha efectiva de entrega. Requiere un flujo específico de programación."
      : fechaEntrega > hoy
        ? `Preparación bloqueada hasta el día de entrega: ${fechaEntrega}. Puedes aceptar el pedido anticipadamente.`
        : "Preparación bloqueada: la fecha de entrega está vencida. Requiere reprogramación mediante un flujo específico aún no disponible.";
  return { permitida, mensaje };
}
