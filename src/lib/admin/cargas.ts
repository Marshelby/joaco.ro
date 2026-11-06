import { crearClienteSupabaseServidor } from "@/lib/supabase/server";

export type CargaJornada = {
  estado: "preparacion" | "lista" | "en_ruta";
  version: number;
  pedidos: { id: string; numero: string; cliente: string; estado: string; incluido: boolean | null; motivo: string | null; pendientes: number; productos: { id: string; nombre: string; cantidad: number | null; importe: number | null; confirmado: boolean }[] }[];
  historial: { version: number; actor: string; instante: string; solicitud: { accion: string; motivo: string | null } }[];
};

export async function leerCargaJornada(fecha: string): Promise<CargaJornada> {
  const supabase = await crearClienteSupabaseServidor();
  const { data, error } = await supabase.rpc("leer_carga_jornada", { p_fecha: fecha });
  if (error) throw new Error("No se pudo leer la carga de la jornada. Comprueba las migraciones pendientes.");
  return data as CargaJornada;
}
