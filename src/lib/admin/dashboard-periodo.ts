import "server-only";
import { esFechaCalendario, hoySantiago, sumarDiasCalendario } from "@/lib/operational-date";

export const periodosDashboard = [
  ["hoy", "Hoy"],
  ["ayer", "Ayer"],
  ["7-dias", "Últimos 7 días"],
  ["30-dias", "Últimos 30 días"],
  ["mes-actual", "Mes actual"],
  ["mes-anterior", "Mes anterior"],
] as const;

type Preajuste = typeof periodosDashboard[number][0];

export type PeriodoDashboard = {
  desde: string;
  hasta: string;
  dias: number;
  seleccionado: Preajuste | "personalizado";
  anteriorDesde: string;
  anteriorHasta: string;
};
export type BusquedaDashboard = Record<string, string | string[] | undefined>;

export const fechaMinimaDashboard = "0001-01-01";
export const fechaMaximaDashboard = "9999-12-30";
const diaMs = 86_400_000;

export function resolverPeriodoDashboard(busqueda: BusquedaDashboard): PeriodoDashboard | { error: string } {
  const hoy = hoySantiago();
  const inicioMes = hoy.slice(0, 7) + "-01";
  const finMesAnterior = sumarDiasCalendario(inicioMes, -1);
  const ayer = sumarDiasCalendario(hoy, -1);
  const rangos: Record<Preajuste, [string, string]> = {
    hoy: [hoy, hoy],
    ayer: [ayer, ayer],
    "7-dias": [sumarDiasCalendario(hoy, -6), hoy],
    "30-dias": [sumarDiasCalendario(hoy, -29), hoy],
    "mes-actual": [inicioMes, hoy],
    "mes-anterior": [finMesAnterior.slice(0, 7) + "-01", finMesAnterior],
  };
  const seleccionado = busqueda.periodo ?? "30-dias";
  const preajuste = periodosDashboard.find(([id]) => id === seleccionado);
  const [desde, hasta] = preajuste ? rangos[preajuste[0]] : [busqueda.desde, busqueda.hasta];

  if (!preajuste && seleccionado !== "personalizado") return { error: "Selecciona un período válido." };
  if (!esFechaCalendario(desde) || !esFechaCalendario(hasta) || hasta > fechaMaximaDashboard || desde > hasta) {
    return { error: "Ingresa dos fechas válidas en orden cronológico." };
  }
  const dias = (Date.parse(hasta) - Date.parse(desde)) / diaMs + 1;
  if (dias > 366) return { error: "El período puede abarcar hasta 366 días, contando ambas fechas." };
  if (Date.parse(desde) - Date.parse(fechaMinimaDashboard) < dias * diaMs) {
    return { error: "La fecha inicial debe permitir un período anterior de igual duración." };
  }
  return { desde, hasta, dias, seleccionado: preajuste?.[0] ?? "personalizado",
    anteriorDesde: sumarDiasCalendario(desde, -dias), anteriorHasta: sumarDiasCalendario(desde, -1) };
}
