"use server";

import { revalidatePath } from "next/cache";

import { crearClienteSupabaseServidor } from "@/lib/supabase/server";

export type EstadoDiaEntrega = { error?: string; exito?: string };

const mensajesRpc: Record<string, string> = {
  NO_AUTORIZADO: "No tienes permisos para cambiar la configuración de entregas.",
  DIA_SEMANA_INVALIDO: "Selecciona un día de la semana válido.",
  ACTIVO_INVALIDO: "No fue posible leer el estado del día.",
  HORA_CORTE_INVALIDA: "Selecciona una hora válida entre 00:00 y 23:59.",
};

function texto(datos: FormData, campo: string) {
  return String(datos.get(campo) ?? "").trim();
}

export async function guardarDiaEntregaAdministrativo(
  _: EstadoDiaEntrega,
  datos: FormData,
): Promise<EstadoDiaEntrega> {
  const diaSemana = Number(texto(datos, "diaSemana"));

  if (!Number.isInteger(diaSemana) || diaSemana < 1 || diaSemana > 7) {
    return { error: mensajesRpc.DIA_SEMANA_INVALIDO };
  }

  const supabase = await crearClienteSupabaseServidor();
  const { data: sesion } = await supabase.auth.getUser();
  if (!sesion.user) return { error: "Tu sesión expiró. Inicia sesión nuevamente." };

  const { error } = await supabase.rpc("guardar_dia_entrega_administrativo", {
    p_dia_semana: diaSemana,
    p_activo: datos.get("activo") === "on",
    p_hora_corte: null,
    p_dias_anticipacion_corte: 0,
  });
  if (error) return { error: mensajesRpc[error.message] ?? "No fue posible guardar este día de entrega." };

  revalidatePath("/admin/configuracion");
  return { exito: "Día de entrega actualizado." };
}

export async function guardarHoraCorteAdministrativa(
  _: EstadoDiaEntrega,
  datos: FormData,
): Promise<EstadoDiaEntrega> {
  const hora = texto(datos, "horaCorte");
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)) {
    return { error: mensajesRpc.HORA_CORTE_INVALIDA };
  }
  const supabase = await crearClienteSupabaseServidor();
  const { data: sesion } = await supabase.auth.getUser();
  if (!sesion.user) return { error: "Tu sesión expiró. Inicia sesión nuevamente." };
  const { error } = await supabase.rpc("guardar_hora_corte_administrativa", { p_hora_corte: hora });
  if (error) return { error: mensajesRpc[error.message] ?? "No fue posible guardar la hora límite." };
  revalidatePath("/admin/configuracion");
  revalidatePath("/checkout");
  return { exito: "Hora límite actualizada para todos los días de entrega." };
}
