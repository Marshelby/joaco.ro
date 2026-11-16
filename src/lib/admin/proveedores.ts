import "server-only";
import { crearClienteSupabaseServidor } from "@/lib/supabase/server";

export type ProveedorResumen = { id: string; nombre: string; descripcion: string | null; telefono: string | null; direccion: string | null; saldo_actual: number };
export type ProveedorDetalle = ProveedorResumen & {
  compras?: { id: string; fecha: string; producto_snapshot: string | null; presentacion_snapshot: string | null; unidad: string | null; cantidad_asignada: number; precio_compra: number; total: number; pagado: number; saldo: number }[];
  asientos_compras?: { id: string; compra_id: string; version: number; concepto: "obligacion" | "pago"; importe: number; actor: string; fecha: string }[];
  movimientos: { id: string; fecha: string; tipo: "deuda" | "abono"; monto: number; comentario: string; administrador_id: string; administrador_nombre: string }[];
};

export async function clienteAdminProveedores() {
  const supabase = await crearClienteSupabaseServidor();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error("NO_AUTORIZADO");
  const { data: perfil, error: errorPerfil } = await supabase.from("perfiles").select("rol").eq("usuario_id", user.id).maybeSingle();
  if (errorPerfil || perfil?.rol !== "admin") throw new Error("NO_AUTORIZADO");
  return supabase;
}

export async function obtenerProveedores(busqueda: string, pagina: number) {
  const supabase = await clienteAdminProveedores();
  let consulta = supabase.from("v_saldos_proveedores").select("id,nombre,descripcion,telefono,direccion,saldo_actual", { count: "exact" });
  if (busqueda) consulta = consulta.ilike("nombre", `%${busqueda.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
  const { data, error, count } = await consulta.order("nombre").order("id").range((pagina - 1) * 50, pagina * 50 - 1);
  if (error) throw error;
  return { proveedores: (data ?? []).map((p) => ({ ...p, saldo_actual: Number(p.saldo_actual) })) as ProveedorResumen[], total: count ?? 0 };
}
