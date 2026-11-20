import "server-only";

import { formatearFechaCalendario, partesSantiago, sumarDiasCalendario } from "@/lib/operational-date";
import { formatearHoraCorte, HORIZONTE_ENTREGAS_DIAS, type DiaSemanaEntrega } from "@/config/delivery-schedule";
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

function diaSemanaIso(fecha: string): DiaSemanaEntrega {
  const dia = new Date(`${fecha}T12:00:00.000Z`).getUTCDay();
  return (dia === 0 ? 7 : dia) as DiaSemanaEntrega;
}

function etiquetaFecha(fecha: string, options: Intl.DateTimeFormatOptions) {
  const texto = formatearFechaCalendario(fecha, options);
  return texto.charAt(0).toLocaleUpperCase("es-CL") + texto.slice(1).replace(",", "");
}

function estaAntesDelCorte(fechaActual: string, horaActual: string, fechaCorte: string, horaCorte: string) {
  return fechaActual < fechaCorte || (fechaActual === fechaCorte && horaActual < `${horaCorte.slice(0, 5)}:00`);
}

export function generarFechasEntregaDisponibles(diasActivos: readonly DiaEntregaActivo[], ahora = new Date()): FechaEntregaDisponible[] {
  const { fecha: fechaActual, hora: horaActual } = partesSantiago(ahora);

  return Array.from({ length: HORIZONTE_ENTREGAS_DIAS + 1 }, (_, indice) => sumarDiasCalendario(fechaActual, indice))
    .flatMap((fecha) => {
      const configuracion = diasActivos.find((dia) => dia.diaSemana === diaSemanaIso(fecha));
      if (!configuracion) return [];

      const fechaCorte = sumarDiasCalendario(fecha, -configuracion.diasAnticipacionCorte);
      if (!estaAntesDelCorte(fechaActual, horaActual, fechaCorte, configuracion.horaCorte)) return [];

      return [{
        fecha,
        etiqueta: etiquetaFecha(fecha, { weekday: "short", day: "numeric", month: "short" }),
        etiquetaLarga: etiquetaFecha(fecha, { weekday: "long", day: "numeric", month: "long" }),
        textoCorte: `Puedes solicitar entrega para esta fecha únicamente antes de las ${formatearHoraCorte(configuracion.horaCorte)} del mismo día, hora America/Santiago.`,
      }];
    });
}

export async function obtenerFechasEntregaDisponibles(): Promise<FechaEntregaDisponible[]> {
  const supabase = await crearClienteSupabaseServidor();
  const { data, error } = await supabase.rpc("obtener_dias_entrega_activos");
  if (error) throw new Error("No fue posible cargar las fechas de entrega disponibles.");
  if (!Array.isArray(data) || !data.every((dia: DiaEntregaActivoFila) => dia &&
    Number.isInteger(dia.dia_semana) && dia.dia_semana >= 1 && dia.dia_semana <= 7 &&
    Number.isSafeInteger(Number(dia.dias_anticipacion_corte)) && dia.dias_anticipacion_corte !== null &&
    Number(dia.dias_anticipacion_corte) >= 0 &&
    typeof dia.hora_corte === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d(?::00(?:\.0+)?)?$/.test(dia.hora_corte))) {
    throw new Error("La configuración de fechas de entrega no es válida.");
  }

  const dias = (data as DiaEntregaActivoFila[]).map((dia) => ({
    diaSemana: dia.dia_semana as DiaSemanaEntrega,
    diasAnticipacionCorte: Number(dia.dias_anticipacion_corte),
    horaCorte: String(dia.hora_corte),
  }));
  return generarFechasEntregaDisponibles(dias);
}
