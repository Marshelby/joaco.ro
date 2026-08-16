import "server-only";

import { crearClienteSupabaseServidor } from "@/lib/supabase/server";

export type DiaEntregaAdministrativo = {
  id: string;
  diaSemana: number;
  activo: boolean;
  diasAnticipacionCorte: number;
  horaCorte: string;
  orden: number;
};

export async function obtenerDiasEntregaAdministrativos(): Promise<DiaEntregaAdministrativo[]> {
  const supabase = await crearClienteSupabaseServidor();
  const { data, error } = await supabase
    .from("dias_entrega")
    .select("id,dia_semana,activo,dias_anticipacion_corte,hora_corte,orden")
    .order("orden", { ascending: true });

  if (error) throw new Error("No fue posible cargar la configuración de entregas.");

  return (data ?? []).map((dia) => ({
    id: dia.id,
    diaSemana: dia.dia_semana,
    activo: dia.activo,
    diasAnticipacionCorte: dia.dias_anticipacion_corte,
    horaCorte: dia.hora_corte,
    orden: dia.orden,
  }));
}
