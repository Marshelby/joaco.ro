import { crearClienteSupabaseServidor } from "@/lib/supabase/server";

export type EstadoPedidoAdmin = "recibido" | "en_revision" | "confirmado" | "programado" | "preparando" | "listo_despacho" | "en_reparto" | "entregado" | "entrega_fallida" | "cancelado";

export type PedidoAdminListado = {
  id: string;
  numeroPedido: string;
  nombreClienteSnapshot: string;
  estado: EstadoPedidoAdmin;
  total: number;
  fechaCreacion: string;
};

export type ItemPedidoAdmin = {
  id: string;
  nombreProductoSnapshot: string;
  nombrePresentacionSnapshot: string | null;
  unidadSnapshot: string;
  cantidad: number;
  precioFinalUnitarioSnapshot: number;
  totalLinea: number;
};

export type PedidoAdminDetalle = PedidoAdminListado & {
  canalOrigen: string;
  telefonoClienteSnapshot: string | null;
  emailClienteSnapshot: string | null;
  direccionSnapshot: string | null;
  comunaSnapshot: string | null;
  regionSnapshot: string | null;
  referenciaDireccionSnapshot: string | null;
  subtotal: number;
  costoEntrega: number;
  descuento: number;
  observacionGeneral: string | null;
  items: readonly ItemPedidoAdmin[];
};

type PedidoListadoFila = {
  id: string;
  numero_pedido: string;
  nombre_cliente_snapshot: string;
  estado: EstadoPedidoAdmin;
  total: number | string;
  fecha_creacion: string;
};

type ItemPedidoFila = {
  id: string;
  nombre_producto_snapshot: string;
  nombre_presentacion_snapshot: string | null;
  unidad_snapshot: string;
  cantidad: number | string;
  precio_final_unitario_snapshot: number | string;
  total_linea: number | string;
};

type PedidoDetalleFila = PedidoListadoFila & {
  canal_origen: string;
  telefono_cliente_snapshot: string | null;
  email_cliente_snapshot: string | null;
  direccion_snapshot: string | null;
  comuna_snapshot: string | null;
  region_snapshot: string | null;
  referencia_direccion_snapshot: string | null;
  subtotal: number | string;
  costo_entrega: number | string;
  descuento: number | string;
  observacion_general: string | null;
  items_pedido: ItemPedidoFila[];
};

function mapPedidoListado(fila: PedidoListadoFila): PedidoAdminListado {
  return {
    id: fila.id,
    numeroPedido: fila.numero_pedido,
    nombreClienteSnapshot: fila.nombre_cliente_snapshot,
    estado: fila.estado,
    total: Number(fila.total),
    fechaCreacion: fila.fecha_creacion,
  };
}

export async function obtenerPedidosAdmin(soloRecibidos: boolean) {
  const supabase = await crearClienteSupabaseServidor();
  let consulta = supabase
    .from("pedidos")
    .select("id,numero_pedido,nombre_cliente_snapshot,estado,total,fecha_creacion")
    .order("fecha_creacion", { ascending: false });

  if (soloRecibidos) consulta = consulta.eq("estado", "recibido");

  const { data, error } = await consulta;
  if (error) throw error;
  return (data as PedidoListadoFila[] ?? []).map(mapPedidoListado);
}

export async function obtenerCantidadPedidosRecibidos() {
  const supabase = await crearClienteSupabaseServidor();
  const { count, error } = await supabase.from("pedidos").select("id", { count: "exact", head: true }).eq("estado", "recibido");
  if (error) throw error;
  return count ?? 0;
}

export async function obtenerPedidoAdmin(id: string): Promise<PedidoAdminDetalle | null> {
  const supabase = await crearClienteSupabaseServidor();
  const { data, error } = await supabase
    .from("pedidos")
    .select("id,numero_pedido,nombre_cliente_snapshot,estado,total,fecha_creacion,canal_origen,telefono_cliente_snapshot,email_cliente_snapshot,direccion_snapshot,comuna_snapshot,region_snapshot,referencia_direccion_snapshot,subtotal,costo_entrega,descuento,observacion_general,items_pedido(id,nombre_producto_snapshot,nombre_presentacion_snapshot,unidad_snapshot,cantidad,precio_final_unitario_snapshot,total_linea)")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const fila = data as unknown as PedidoDetalleFila;
  return {
    ...mapPedidoListado(fila),
    canalOrigen: fila.canal_origen,
    telefonoClienteSnapshot: fila.telefono_cliente_snapshot,
    emailClienteSnapshot: fila.email_cliente_snapshot,
    direccionSnapshot: fila.direccion_snapshot,
    comunaSnapshot: fila.comuna_snapshot,
    regionSnapshot: fila.region_snapshot,
    referenciaDireccionSnapshot: fila.referencia_direccion_snapshot,
    subtotal: Number(fila.subtotal),
    costoEntrega: Number(fila.costo_entrega),
    descuento: Number(fila.descuento),
    observacionGeneral: fila.observacion_general,
    items: (fila.items_pedido ?? []).map((item) => ({
      id: item.id,
      nombreProductoSnapshot: item.nombre_producto_snapshot,
      nombrePresentacionSnapshot: item.nombre_presentacion_snapshot,
      unidadSnapshot: item.unidad_snapshot,
      cantidad: Number(item.cantidad),
      precioFinalUnitarioSnapshot: Number(item.precio_final_unitario_snapshot),
      totalLinea: Number(item.total_linea),
    })),
  };
}

const etiquetasEstado: Record<EstadoPedidoAdmin, string> = {
  recibido: "Recibido",
  en_revision: "En revisión",
  confirmado: "Confirmado",
  programado: "Programado",
  preparando: "Preparando",
  listo_despacho: "Listo para despacho",
  en_reparto: "En reparto",
  entregado: "Entregado",
  entrega_fallida: "Entrega fallida",
  cancelado: "Cancelado",
};

export function obtenerEtiquetaEstadoPedido(estado: EstadoPedidoAdmin) {
  return etiquetasEstado[estado];
}

export function formatearCantidadPedido(cantidad: number, unidad: string) {
  const texto = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 3 }).format(cantidad);
  return unidad === "KG" ? `${texto} kg` : texto;
}
