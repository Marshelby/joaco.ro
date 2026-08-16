import "server-only";

import { DELIVERY_TIME_ZONE, HORIZONTE_ENTREGAS_DIAS, type DiaSemanaEntrega } from "@/config/delivery-schedule";
import { crearClienteSupabaseServidor } from "@/lib/supabase/server";
import type { FechaEntregaDisponible } from "@/types/delivery";

export type DiaEntregaActivo = {
  diaSemana: DiaSemanaEntrega;
  diasAnticipacionCorte: number;
  horaCorte: string;
};

type DiaEntregaActivoFila = {
  dia_semana: number;
  dias_anticipacion_corte: number | string;
  hora_corte: string;
};

export type { FechaEntregaDisponible } from "@/types/delivery";

function partesFecha(date: Date) {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: DELIVERY_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const valor = (type: Intl.DateTimeFormatPartTypes) => partes.find((part) => part.type === type)?.value ?? "";
  return { fecha: `${valor("year")}-${valor("month")}-${valor("day")}`, hora: `${valor("hour")}:${valor("minute")}:${valor("second")}` };
}

function sumarDias(fecha: string, dias: number) {
  const date = new Date(`${fecha}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + dias);
  return date.toISOString().slice(0, 10);
}

function diaSemanaIso(fecha: string): DiaSemanaEntrega {
  const dia = new Date(`${fecha}T12:00:00.000Z`).getUTCDay();
  return (dia === 0 ? 7 : dia) as DiaSemanaEntrega;
}

function nombreDia(dia: DiaSemanaEntrega) {
  return ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"][dia - 1];
}

function etiquetaFecha(fecha: string, options: Intl.DateTimeFormatOptions) {
  const texto = new Intl.DateTimeFormat("es-CL", { ...options, timeZone: DELIVERY_TIME_ZONE }).format(new Date(`${fecha}T12:00:00.000Z`));
  return texto.charAt(0).toLocaleUpperCase("es-CL") + texto.slice(1).replace(",", "");
}

function esPosteriorACorte(fechaActual: string, horaActual: string, fechaCorte: string, horaCorte: string) {
  return fechaActual < fechaCorte || (fechaActual === fechaCorte && horaActual < `${horaCorte.slice(0, 5)}:00`);
}

export function generarFechasEntregaDisponibles(diasActivos: readonly DiaEntregaActivo[], ahora = new Date()): FechaEntregaDisponible[] {
  const { fecha: fechaActual, hora: horaActual } = partesFecha(ahora);

  return Array.from({ length: HORIZONTE_ENTREGAS_DIAS + 1 }, (_, indice) => sumarDias(fechaActual, indice))
    .flatMap((fecha) => {
      const configuracion = diasActivos.find((dia) => dia.diaSemana === diaSemanaIso(fecha));
      if (!configuracion) return [];

      const fechaCorte = sumarDias(fecha, -configuracion.diasAnticipacionCorte);
      if (!esPosteriorACorte(fechaActual, horaActual, fechaCorte, configuracion.horaCorte)) return [];

      const diaAnterior = diaSemanaIso(fechaCorte);
      return [{
        fecha,
        etiqueta: etiquetaFecha(fecha, { weekday: "short", day: "numeric", month: "short" }),
        etiquetaLarga: etiquetaFecha(fecha, { weekday: "long", day: "numeric", month: "long" }),
        textoCorte: `Pedidos para esta fecha se reciben hasta el ${nombreDia(diaAnterior).toLocaleLowerCase("es-CL")} a las ${configuracion.horaCorte.slice(0, 5)}.`,
      }];
    });
}

export async function obtenerFechasEntregaDisponibles(): Promise<FechaEntregaDisponible[]> {
  const supabase = await crearClienteSupabaseServidor();
  const { data, error } = await supabase.rpc("obtener_dias_entrega_activos");
  if (error) throw new Error("No fue posible cargar las fechas de entrega disponibles.");

  const dias = ((data ?? []) as DiaEntregaActivoFila[]).map((dia) => ({
    diaSemana: dia.dia_semana as DiaSemanaEntrega,
    diasAnticipacionCorte: Number(dia.dias_anticipacion_corte),
    horaCorte: String(dia.hora_corte),
  }));
  return generarFechasEntregaDisponibles(dias);
}
