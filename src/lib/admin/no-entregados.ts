import "server-only";
import { crearClienteSupabaseServidor } from "@/lib/supabase/server";

export type FiltrosNoEntregados = { q?: string; desde?: string; hasta?: string; pagina?: string };
export type PedidoNoEntregado = {
  id: string; numero_pedido: string; cliente: string; fecha_entrega: string | null;
  total: number; fecha_fallo: string | null; motivo: string | null;
  observaciones: string | null; historico: boolean;
  productos: { nombre: string; presentacion: string | null; cantidad: number; unidad: string }[];
};
export async function obtenerNoEntregados(filtros: FiltrosNoEntregados) {
  const supabase = await crearClienteSupabaseServidor();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  const { data: admin, error: adminError } = await supabase.rpc("es_admin");
  if (authError || !user || adminError || admin !== true) throw new Error("NO_AUTORIZADO");
  const fechaValida = (s?: string) => !s || (/^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s);
  if (!fechaValida(filtros.desde) || !fechaValida(filtros.hasta) || (filtros.desde && filtros.hasta && filtros.desde > filtros.hasta)) return { error: "Revisa el rango de fechas de entrega.", pedidos: [], total: 0, pagina: 1 };
  const pagina = Math.min(100000, Math.max(1, Number(filtros.pagina) || 1));
  const { data, error } = await supabase.rpc("leer_no_entregados_admin", {
    p_busqueda: (filtros.q ?? "").trim().slice(0, 200), p_desde: filtros.desde || null,
    p_hasta: filtros.hasta || null, p_pagina: Math.floor(pagina),
  });
  if (error) return { error: error.code === "PGRST202" ? "La sección requiere instalar el SQL manual de Fase 3 para habilitar sus lecturas." : "No se pudieron consultar los pedidos. Intenta nuevamente.", pedidos: [], total: 0, pagina: 1 };
  return { error: null, pedidos: (data?.pedidos ?? []) as PedidoNoEntregado[], total: Number(data?.total ?? 0), pagina: Math.floor(pagina) };
}
