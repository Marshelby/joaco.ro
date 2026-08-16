export const DELIVERY_TIME_ZONE = "America/Santiago";
export const HORIZONTE_ENTREGAS_DIAS = 14;

export const DIAS_SEMANA_ENTREGA = [
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
  "Domingo",
] as const;

export type DiaSemanaEntrega = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export function esDiaSemanaEntrega(valor: number): valor is DiaSemanaEntrega {
  return Number.isInteger(valor) && valor >= 1 && valor <= 7;
}

export function nombreDiaSemana(diaSemana: DiaSemanaEntrega): string {
  return DIAS_SEMANA_ENTREGA[diaSemana - 1];
}

export function diaAnterior(diaSemana: DiaSemanaEntrega): DiaSemanaEntrega {
  return diaSemana === 1 ? 7 : (diaSemana - 1) as DiaSemanaEntrega;
}

export function formatearHoraCorte(hora: string): string {
  const coincidencia = /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(hora);
  if (!coincidencia) return hora;

  const horas = Number(coincidencia[1]);
  const minutos = Number(coincidencia[2]);
  if (horas > 23 || minutos > 59) return hora;

  // `time without time zone` representa una hora local de la operación.
  // No se convierte con UTC para evitar desplazarla por DST de Chile.
  return `${String(horas).padStart(2, "0")}:${String(minutos).padStart(2, "0")}`;
}

/** El corte es exclusivo: desde la hora indicada ya no se aceptan pedidos. */
export function estaAntesDeHoraCorte(horaActual: string, horaCorte: string): boolean {
  const convertirMinutos = (hora: string) => {
    const coincidencia = /^(\d{2}):(\d{2})$/.exec(hora);
    if (!coincidencia) return null;
    const horas = Number(coincidencia[1]);
    const minutos = Number(coincidencia[2]);
    return horas <= 23 && minutos <= 59 ? horas * 60 + minutos : null;
  };

  const actual = convertirMinutos(horaActual);
  const corte = convertirMinutos(horaCorte);
  return actual !== null && corte !== null && actual < corte;
}
