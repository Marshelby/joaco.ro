"use server";

import { revalidatePath } from "next/cache";

import { crearClienteSupabaseServidor } from "@/lib/supabase/server";

export type EstadoDiaEntrega = { error?: string; exito?: string };

const mensajesRpc: Record<string, string> = {
  NO_AUTORIZADO: "No tienes permisos para cambiar la configuración de entregas.",
  DIA_SEMANA_INVALIDO: "Selecciona un día de la semana válido.",
  ACTIVO_INVALIDO: "No fue posible leer el estado del día.",
  HORA_CORTE_INVALIDA: "Ingresa una hora límite válida.",
};

function texto(datos: FormData, campo: string) {
  return String(datos.get(campo) ?? "").trim();
}

function horaCorteValida(valor: string) {
  const coincidencia = /^(\d{2}):(\d{2})$/.exec(valor);
  if (!coincidencia) return false;
  const horas = Number(coincidencia[1]);
  const minutos = Number(coincidencia[2]);
  return horas >= 0 && horas <= 23 && minutos >= 0 && minutos <= 59;
}

export async function guardarDiaEntregaAdministrativo(
  _: EstadoDiaEntrega,
  datos: FormData,
): Promise<EstadoDiaEntrega> {
  const diaSemana = Number(texto(datos, "diaSemana"));
  const horaCorte = texto(datos, "horaCorte");

  if (!Number.isInteger(diaSemana) || diaSemana < 1 || diaSemana > 7) {
    return { error: mensajesRpc.DIA_SEMANA_INVALIDO };
  }
  if (!horaCorteValida(horaCorte)) return { error: mensajesRpc.HORA_CORTE_INVALIDA };

  const supabase = await crearClienteSupabaseServidor();
  const { data: sesion } = await supabase.auth.getUser();
  if (!sesion.user) return { error: "Tu sesión expiró. Inicia sesión nuevamente." };

  const { error } = await supabase.rpc("guardar_dia_entrega_administrativo", {
    p_dia_semana: diaSemana,
    p_activo: datos.get("activo") === "on",
    p_hora_corte: horaCorte,
  });
  if (error) return { error: mensajesRpc[error.message] ?? "No fue posible guardar este día de entrega." };

  revalidatePath("/admin/configuracion");
  return { exito: "Día de entrega actualizado." };
}
