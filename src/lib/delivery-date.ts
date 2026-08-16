import { DELIVERY_TIME_ZONE } from "@/config/delivery-schedule";

function dateOnlyToDate(fecha: string) {
  return new Date(`${fecha}T12:00:00.000Z`);
}

export function formatFechaEntregaLarga(fecha: string) {
  const texto = new Intl.DateTimeFormat("es-CL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: DELIVERY_TIME_ZONE,
  }).format(dateOnlyToDate(fecha));
  return texto.charAt(0).toLocaleUpperCase("es-CL") + texto.slice(1);
}

export function formatFechaEntregaCorta(fecha: string) {
  return new Intl.DateTimeFormat("es-CL", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: DELIVERY_TIME_ZONE,
  }).format(dateOnlyToDate(fecha)).replace(",", "");
}
