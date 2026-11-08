"use server";

import { revalidatePath } from "next/cache";

import { crearClienteSupabaseServidor } from "@/lib/supabase/server";

export type EstadoDiaEntrega = { error?: string; exito?: string };

const mensajesRpc: Record<string, string> = {
  NO_AUTORIZADO: "No tienes permisos para cambiar la configuración de entregas.",
  DIA_SEMANA_INVALIDO: "Selecciona un día de la semana válido.",
  ACTIVO_INVALIDO: "No fue posible leer el estado del día.",
  HORA_CORTE_INVALIDA: "La hora de corte debe ser 16:00.",
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
    p_hora_corte: "16:00",
    p_dias_anticipacion_corte: 0,
  });
  if (error) return { error: mensajesRpc[error.message] ?? "No fue posible guardar este día de entrega." };

  revalidatePath("/admin/configuracion");
  return { exito: "Día de entrega actualizado." };
}
