import { formatDateCL } from "@/lib/formatters";
import { formatearInstanteSantiago, leerInstante, partesSantiago } from "@/lib/operational-date";

export function formatHoraMensaje(value: string) {
  return formatearInstanteSantiago(value, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
}

export const formatDiaMensaje = formatDateCL;

export function claveDiaMensaje(value: string) {
  return partesSantiago(leerInstante(value)).fecha;
}
