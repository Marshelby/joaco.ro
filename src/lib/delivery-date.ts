import { formatearFechaCalendario } from "@/lib/operational-date";
export function formatFechaEntregaLarga(fecha: string) {
  const texto = formatearFechaCalendario(fecha, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return texto.charAt(0).toLocaleUpperCase("es-CL") + texto.slice(1);
}

export function formatFechaEntregaCorta(fecha: string) {
  return formatearFechaCalendario(fecha, {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).replace(",", "");
}
