import "server-only";
import { crearClienteSupabaseServidor } from "@/lib/supabase/server";
import { fasePosiblesPedidosHabilitada } from "./configuracion";

export type PosiblePedido = {
  id: string; codigo_publico: string; nombre_solicitante: string; telefono_contacto: string; fecha_entrega_solicitada: string;
  observaciones: string | null; estado: "registrado" | "en_gestion" | "convertido" | "descartado"; version: number;
  subtotal_estimado: number; costo_entrega_estimado: number; total_estimado: number;
  cliente_id: string | null; pedido_oficial_id: string | null; fecha_creacion: string;
};
export type LineaPosible = {
  id: string; presentacion_producto_id: string; nombre_producto_snapshot: string; nombre_presentacion_snapshot: string;
  unidad_snapshot: string; cantidad: number; cantidad_original: number; activo: boolean; orden: number; subtotal: number;
  precio_neto_original_snapshot: number; precio_venta_original_snapshot: number;
  precio_neto_autorizado: number | null; precio_venta_autorizado: number | null; motivo_autorizacion_precio: string | null; fecha_autorizacion_precio: string | null;
};
export type EventoPosible = { id: string; evento: string; version_resultante: number; fecha_creacion: string; motivo: string | null; administrador_id: string | null; cambios: Record<string,unknown> };
export type ClientePosible = { id: string; nombre: string; telefono: string | null };
export type DireccionPosible = { id: string; direccion: string; comuna: string; latitud: number | null; longitud: number | null };
export type PresentacionPosible = { id: string; nombre: string; precio_final: number; productos: { nombre: string } };
const columnas = "id,codigo_publico,nombre_solicitante,telefono_contacto,fecha_entrega_solicitada,observaciones,estado,version,subtotal_estimado,costo_entrega_estimado,total_estimado,cliente_id,pedido_oficial_id,fecha_creacion";
export async function clienteAdministradorPosibles() {
  if (!fasePosiblesPedidosHabilitada()) throw new Error("FLUJO_DESHABILITADO");
  const supabase = await crearClienteSupabaseServidor();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error("NO_AUTORIZADO");
  const { data: admin, error: errorAdmin } = await supabase.rpc("es_admin");
  if (errorAdmin || admin !== true) throw new Error("NO_AUTORIZADO");
  return supabase;
}
export async function listarPosiblesPedidos(estado: string, pagina: number) {
  const supabase = await clienteAdministradorPosibles();
  let consulta = supabase.from("posibles_pedidos").select(columnas, { count: "exact" });
  if (estado === "pendientes") consulta = consulta.in("estado", ["registrado","en_gestion"]);
  else if (["convertido","descartado"].includes(estado)) consulta = consulta.eq("estado", estado);
  const { data, error, count } = await consulta.order("fecha_creacion", { ascending: false }).order("id").range((pagina-1)*25,pagina*25-1);
  if (error) throw new Error("LECTURA_NO_DISPONIBLE");
  return { solicitudes: (data ?? []) as PosiblePedido[], total: count ?? 0 };
}
export async function detallePosiblePedido(id: string, buscarCliente = "") {
  const supabase = await clienteAdministradorPosibles();
  const { data: pedido, error } = await supabase.from("posibles_pedidos").select(columnas).eq("id", id).maybeSingle();
  if (error) throw new Error("LECTURA_NO_DISPONIBLE");
  if (!pedido) return null;
  let clientesQuery = supabase.from("clientes").select("id,nombre,telefono").eq("activo",true).order("nombre").limit(100);
  if (buscarCliente) clientesQuery = clientesQuery.ilike("nombre", `%${buscarCliente.replace(/[\\%_]/g,"\\$&")}%`);
  const [lineas, eventos, clientes, direcciones, fechas, presentaciones, asociado] = await Promise.all([
    supabase.from("items_posible_pedido").select("id,presentacion_producto_id,nombre_producto_snapshot,nombre_presentacion_snapshot,unidad_snapshot,cantidad,cantidad_original,activo,orden,subtotal,precio_neto_original_snapshot,precio_venta_original_snapshot,precio_neto_autorizado,precio_venta_autorizado,motivo_autorizacion_precio,fecha_autorizacion_precio").eq("posible_pedido_id",id).order("orden"),
    supabase.from("historial_posibles_pedidos").select("id,evento,version_resultante,fecha_creacion,motivo,administrador_id,cambios").eq("posible_pedido_id",id).order("version_resultante", { ascending: false }),
    clientesQuery,
    pedido.cliente_id ? supabase.from("direcciones_cliente").select("id,direccion,comuna,latitud,longitud").eq("cliente_id",pedido.cliente_id).eq("activa",true) : Promise.resolve({ data: [], error: null }),
    supabase.rpc("obtener_fechas_posibles_pedidos"),
    supabase.from("presentaciones_producto").select("id,nombre,precio_final,productos!inner(nombre,activo,disponible)").eq("activa",true).eq("es_principal",true).eq("productos.activo",true).eq("productos.disponible",true).order("nombre").limit(500),
    pedido.cliente_id ? supabase.from("clientes").select("id,nombre,telefono").eq("id",pedido.cliente_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
  ]);
  if ([lineas,eventos,clientes,direcciones,fechas,presentaciones,asociado].some((r) => r.error)) throw new Error("LECTURA_NO_DISPONIBLE");
  return { pedido: pedido as PosiblePedido, lineas: (lineas.data ?? []) as LineaPosible[], eventos: (eventos.data ?? []) as EventoPosible[], clientes: (clientes.data ?? []) as ClientePosible[], direcciones: (direcciones.data ?? []) as DireccionPosible[], fechas: (fechas.data ?? []).map((f: { fecha: string }) => f.fecha) as string[], presentaciones: (presentaciones.data ?? []) as unknown as PresentacionPosible[], asociado: asociado.data as ClientePosible | null };
}
