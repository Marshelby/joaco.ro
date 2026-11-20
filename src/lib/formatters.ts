import { esFechaCalendario, formatearFechaCalendario, formatearInstanteSantiago } from "@/lib/operational-date";
export function formatCLP(value: number) {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(value);
}

const fechaLarga = { day: "numeric", month: "long", year: "numeric" } as const;

export function formatDateCL(value: string) {
  return esFechaCalendario(value)
    ? formatearFechaCalendario(value, fechaLarga)
    : formatearInstanteSantiago(value, fechaLarga);
}

export function formatDateTimeCL(value: string | null | undefined) {
  return formatearInstanteSantiago(value, {
    ...fechaLarga,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
}
