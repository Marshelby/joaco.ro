import { DELIVERY_TIME_ZONE } from "@/config/delivery-schedule";

export function esFechaCalendario(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000")) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function sumarDiasCalendario(fecha: string, dias: number) {
  const date = new Date(`${fecha}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + dias);
  return date.toISOString().slice(0, 10);
}

export function formatearFechaCalendario(value: string, options: Intl.DateTimeFormatOptions) {
  if (!esFechaCalendario(value)) return "Fecha no disponible";
  return new Intl.DateTimeFormat("es-CL", { ...options, timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}

export function leerInstante(value: string) {
  // Un timestamp sin zona es ambiguo. El origen debe indicar su offset.
  if (!/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}(?::?\d{2})?)$/i.test(value)) return NaN;
  if (!esFechaCalendario(value.slice(0, 10))) return NaN;

  const iso = value.replace(" ", "T");
  const normalizado = /[+-]\d{2}$/.test(iso) ? `${iso}:00` : iso;
  return Date.parse(normalizado);
}

export function formatearInstanteSantiago(value: string | null | undefined, options: Intl.DateTimeFormatOptions) {
  const instante = value ? leerInstante(value) : NaN;
  if (!Number.isFinite(instante)) return "Fecha y hora no disponibles";
  return new Intl.DateTimeFormat("es-CL", { ...options, timeZone: DELIVERY_TIME_ZONE }).format(instante);
}

const relojSantiago = new Intl.DateTimeFormat("en-CA", {
  timeZone: DELIVERY_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

export function partesSantiago(instante: Date | number) {
  if (!Number.isFinite(typeof instante === "number" ? instante : instante.getTime())) {
    return { fecha: "", hora: "" };
  }
  const partes = relojSantiago.formatToParts(instante);
  const valor = (tipo: Intl.DateTimeFormatPartTypes) => partes.find((parte) => parte.type === tipo)?.value ?? "";
  return {
    fecha: `${valor("year").padStart(4, "0")}-${valor("month")}-${valor("day")}`,
    hora: `${valor("hour")}:${valor("minute")}:${valor("second")}`,
  };
}

export function hoySantiago(ahora = new Date()) {
  return partesSantiago(ahora).fecha;
}
