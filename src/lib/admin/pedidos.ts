import { crearClienteSupabaseServidor } from "@/lib/supabase/server";
import { DELIVERY_TIME_ZONE } from "@/config/delivery-schedule";

export type EstadoPedidoAdmin = "recibido" | "en_revision" | "confirmado" | "programado" | "preparando" | "listo_despacho" | "en_reparto" | "entregado" | "entrega_fallida" | "cancelado";

export type PedidoAdminListado = {
  id: string;
  numeroPedido: string;
  nombreClienteSnapshot: string;
  estado: EstadoPedidoAdmin;
  total: number;
  fechaCreacion: string;
  fechaEntrega: string | null;
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

export type EntregaAgrupadaAdmin = {
  fecha: string;
  cantidadPedidos: number;
  total: number;
  cantidadClientes: number;
};

export type PedidoEntregaAdmin = PedidoAdminListado & {
  destinatarioEntrega: string | null;
  zonaEntrega: string | null;
};

export type ResumenProductoEntrega = {
  clave: string;
  producto: string;
  presentacion: string | null;
  unidad: string;
  cantidadTotal: number;
};

export type DetalleEntregaAdmin = {
  fecha: string;
  pedidos: readonly PedidoEntregaAdmin[];
  resumenProductos: readonly ResumenProductoEntrega[];
  total: number;
  cantidadClientes: number;
};

export type PedidoAdminDetalle = PedidoAdminListado & {
  canalOrigen: string;
  telefonoClienteSnapshot: string | null;
  emailClienteSnapshot: string | null;
  direccionSnapshot: string | null;
  comunaSnapshot: string | null;
  regionSnapshot: string | null;
  referenciaDireccionSnapshot: string | null;
  destinatarioEntrega: string | null;
  telefonoContactoEntrega: string | null;
  zonaEntrega: string | null;
  latitudEntrega: number | null;
  longitudEntrega: number | null;
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
  fecha_entrega: string | null;
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

type PedidoEntregaFila = PedidoListadoFila & {
  cliente_id: string | null;
  destinatario_entrega_snapshot: string | null;
  zona_entrega_snapshot: string | null;
};

type ItemPedidoEntregaFila = {
  pedido_id: string;
  producto_id: string | null;
  presentacion_producto_id: string | null;
  nombre_producto_snapshot: string;
  nombre_presentacion_snapshot: string | null;
  unidad_snapshot: string;
  cantidad: number | string;
};

type PedidoDetalleFila = PedidoListadoFila & {
  canal_origen: string;
  telefono_cliente_snapshot: string | null;
  email_cliente_snapshot: string | null;
  direccion_snapshot: string | null;
  comuna_snapshot: string | null;
  region_snapshot: string | null;
  referencia_direccion_snapshot: string | null;
  destinatario_entrega_snapshot: string | null;
  telefono_contacto_entrega_snapshot: string | null;
  zona_entrega_snapshot: string | null;
  latitud_entrega_snapshot: number | string | null;
  longitud_entrega_snapshot: number | string | null;
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
    fechaEntrega: fila.fecha_entrega,
  };
}

function obtenerFechaLocalActual() {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: DELIVERY_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const valor = (type: Intl.DateTimeFormatPartTypes) => partes.find((parte) => parte.type === type)?.value ?? "";
  return `${valor("year")}-${valor("month")}-${valor("day")}`;
}

function esEstadoIncluidoEnEntrega(estado: EstadoPedidoAdmin) {
  return estado !== "cancelado";
}

export async function obtenerPedidosAdmin(soloRecibidos: boolean) {
  const supabase = await crearClienteSupabaseServidor();
  let consulta = supabase
    .from("pedidos")
    .select("id,numero_pedido,nombre_cliente_snapshot,estado,total,fecha_creacion,fecha_entrega")
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

export async function obtenerEntregasProximasAdmin(): Promise<EntregaAgrupadaAdmin[]> {
  const supabase = await crearClienteSupabaseServidor();
  const { data, error } = await supabase
    .from("pedidos")
    .select("fecha_entrega,total,cliente_id,estado")
    .not("fecha_entrega", "is", null)
    .gte("fecha_entrega", obtenerFechaLocalActual())
    .neq("estado", "cancelado")
    .order("fecha_entrega", { ascending: true });

  if (error) throw error;

  const entregas = new Map<string, EntregaAgrupadaAdmin>();
  for (const pedido of (data ?? []) as Array<{ fecha_entrega: string; total: number | string; cliente_id: string | null; estado: EstadoPedidoAdmin }>) {
    if (!esEstadoIncluidoEnEntrega(pedido.estado)) continue;
    const existente = entregas.get(pedido.fecha_entrega) ?? {
      fecha: pedido.fecha_entrega,
      cantidadPedidos: 0,
      total: 0,
      cantidadClientes: 0,
    };
    existente.cantidadPedidos += 1;
    existente.total += Number(pedido.total);
    entregas.set(pedido.fecha_entrega, existente);
  }

  const clientesPorFecha = new Map<string, Set<string>>();
  for (const pedido of (data ?? []) as Array<{ fecha_entrega: string; cliente_id: string | null }>) {
    if (!pedido.cliente_id) continue;
    const clientes = clientesPorFecha.get(pedido.fecha_entrega) ?? new Set<string>();
    clientes.add(pedido.cliente_id);
    clientesPorFecha.set(pedido.fecha_entrega, clientes);
  }

  return [...entregas.values()].map((entrega) => ({
    ...entrega,
    cantidadClientes: clientesPorFecha.get(entrega.fecha)?.size ?? 0,
  }));
}

export async function obtenerDetalleEntregaAdmin(fecha: string): Promise<DetalleEntregaAdmin> {
  const supabase = await crearClienteSupabaseServidor();
  const { data, error } = await supabase
    .from("pedidos")
    .select("id,numero_pedido,nombre_cliente_snapshot,estado,total,fecha_creacion,fecha_entrega,cliente_id,destinatario_entrega_snapshot,zona_entrega_snapshot")
    .eq("fecha_entrega", fecha)
    .neq("estado", "cancelado")
    .order("fecha_creacion", { ascending: true });

  if (error) throw error;

  const filas = ((data ?? []) as PedidoEntregaFila[]).filter((pedido) => esEstadoIncluidoEnEntrega(pedido.estado));
  const pedidos = filas.map((pedido) => ({
    ...mapPedidoListado(pedido),
    destinatarioEntrega: pedido.destinatario_entrega_snapshot,
    zonaEntrega: pedido.zona_entrega_snapshot,
  }));
  const idsPedidos = pedidos.map((pedido) => pedido.id);

  const resumen = new Map<string, ResumenProductoEntrega>();
  if (idsPedidos.length > 0) {
    const { data: items, error: errorItems } = await supabase
      .from("items_pedido")
      .select("pedido_id,producto_id,presentacion_producto_id,nombre_producto_snapshot,nombre_presentacion_snapshot,unidad_snapshot,cantidad")
      .in("pedido_id", idsPedidos);
    if (errorItems) throw errorItems;

    for (const item of (items ?? []) as ItemPedidoEntregaFila[]) {
      const claveProducto = item.producto_id ?? `snapshot-producto:${item.nombre_producto_snapshot}`;
      const clavePresentacion = item.presentacion_producto_id ?? `snapshot-presentacion:${item.nombre_presentacion_snapshot ?? ""}`;
      const clave = `${claveProducto}|${clavePresentacion}|${item.unidad_snapshot}`;
      const existente = resumen.get(clave) ?? {
        clave,
        producto: item.nombre_producto_snapshot,
        presentacion: item.nombre_presentacion_snapshot,
        unidad: item.unidad_snapshot,
        cantidadTotal: 0,
      };
      existente.cantidadTotal += Number(item.cantidad);
      resumen.set(clave, existente);
    }
  }

  return {
    fecha,
    pedidos,
    resumenProductos: [...resumen.values()].sort((a, b) =>
      a.producto.localeCompare(b.producto, "es-CL") || (a.presentacion ?? "").localeCompare(b.presentacion ?? "", "es-CL"),
    ),
    total: pedidos.reduce((acumulado, pedido) => acumulado + pedido.total, 0),
    cantidadClientes: new Set(filas.flatMap((pedido) => pedido.cliente_id ? [pedido.cliente_id] : [])).size,
  };
}

export async function obtenerPedidoAdmin(id: string): Promise<PedidoAdminDetalle | null> {
  const supabase = await crearClienteSupabaseServidor();
  const { data, error } = await supabase
    .from("pedidos")
    .select("id,numero_pedido,nombre_cliente_snapshot,estado,total,fecha_creacion,fecha_entrega,canal_origen,telefono_cliente_snapshot,email_cliente_snapshot,direccion_snapshot,comuna_snapshot,region_snapshot,referencia_direccion_snapshot,destinatario_entrega_snapshot,telefono_contacto_entrega_snapshot,zona_entrega_snapshot,latitud_entrega_snapshot,longitud_entrega_snapshot,subtotal,costo_entrega,descuento,observacion_general,items_pedido(id,nombre_producto_snapshot,nombre_presentacion_snapshot,unidad_snapshot,cantidad,precio_final_unitario_snapshot,total_linea)")
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
    destinatarioEntrega: fila.destinatario_entrega_snapshot,
    telefonoContactoEntrega: fila.telefono_contacto_entrega_snapshot,
    zonaEntrega: fila.zona_entrega_snapshot,
    latitudEntrega: fila.latitud_entrega_snapshot === null ? null : Number(fila.latitud_entrega_snapshot),
    longitudEntrega: fila.longitud_entrega_snapshot === null ? null : Number(fila.longitud_entrega_snapshot),
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

export function formatearCantidadConUnidadEntrega(cantidad: number, unidad: string) {
  const texto = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 3 }).format(cantidad);
  return unidad === "KG" ? `${texto} kg` : `${texto} unidades`;
}
