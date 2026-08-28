import { crearClienteSupabaseServidor } from "@/lib/supabase/server";
import { DELIVERY_TIME_ZONE } from "@/config/delivery-schedule";
import { formatearCantidadPreparacionEntrega } from "@/lib/delivery-preparation-quantity";
import type { ModoCantidadSnapshot, PreparacionEstado } from "@/lib/order-preparation";
import type { MetodoPagoPrevisto } from "@/lib/payment-intent";

export type EstadoPedidoAdmin = "recibido" | "en_revision" | "confirmado" | "programado" | "preparando" | "listo_despacho" | "en_reparto" | "entregado" | "entrega_fallida" | "cancelado";

export type PedidoAdminListado = {
  id: string;
  numeroPedido: string;
  nombreClienteSnapshot: string;
  estado: EstadoPedidoAdmin;
  total: number;
  fechaCreacion: string;
  fechaEntrega: string | null;
  preparacionEstado: PreparacionEstado | null;
  subtotalFinal: number | null;
  totalFinal: number | null;
};

export type ItemPedidoAdmin = {
  id: string;
  nombreProductoSnapshot: string;
  nombrePresentacionSnapshot: string | null;
  unidadSnapshot: string;
  rutaImagen: string | null;
  cantidad: number;
  precioFinalUnitarioSnapshot: number;
  totalLinea: number;
};

export type EntregaAgrupadaAdmin = {
  fecha: string;
  cantidadPedidos: number;
  total: number;
  cantidadClientes: number;
  resumenProductos: readonly ResumenProductoEntrega[];
  cantidadPedidosIncompletos: number;
};

export type ItemPreparacionPedidoAdmin = {
  id: string;
  pedidoId: string;
  nombreProducto: string;
  nombrePresentacion: string | null;
  unidad: string;
  cantidad: number;
  modoCantidadSnapshot: ModoCantidadSnapshot | null;
  cantidadPreparada: number | null;
  cantidadFaltante: number;
  motivoFaltante: string | null;
  tieneFaltante: boolean;
};

export type PedidoEntregaAdmin = PedidoAdminListado & {
  clienteId: string | null;
  destinatarioEntrega: string | null;
  zonaEntrega: string | null;
  items: readonly ItemPreparacionPedidoAdmin[];
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
  resumenFaltantes: readonly ItemPreparacionPedidoAdmin[];
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
  metodosPagoPrevistos: readonly MetodoPagoPrevisto[] | null;
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
  preparacion_estado: PreparacionEstado | null;
  subtotal_final: number | string | null;
  total_final: number | string | null;
};

type ItemPedidoFila = {
  id: string;
  nombre_producto_snapshot: string;
  nombre_presentacion_snapshot: string | null;
  unidad_snapshot: string;
  productos: { ruta_imagen: string | null } | null;
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
  id: string;
  pedido_id: string;
  producto_id: string | null;
  presentacion_producto_id: string | null;
  nombre_producto_snapshot: string;
  nombre_presentacion_snapshot: string | null;
  unidad_snapshot: string;
  cantidad: number | string;
  modo_cantidad_snapshot: ModoCantidadSnapshot | null;
};

type PreparacionItemFila = {
  item_pedido_id: string;
  cantidad_preparada: number | string;
  motivo_faltante: string | null;
};

export type ItemParaConsolidarEntrega = Pick<
  ItemPedidoEntregaFila,
  "producto_id" | "presentacion_producto_id" | "nombre_producto_snapshot" | "nombre_presentacion_snapshot" | "unidad_snapshot" | "cantidad"
>;

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
  metodos_pago_previstos: string[] | null;
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
    preparacionEstado: fila.preparacion_estado,
    subtotalFinal: fila.subtotal_final === null ? null : Number(fila.subtotal_final),
    totalFinal: fila.total_final === null ? null : Number(fila.total_final),
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

export function consolidarItemsEntrega(items: readonly ItemParaConsolidarEntrega[]): ResumenProductoEntrega[] {
  const resumen = new Map<string, ResumenProductoEntrega>();

  for (const item of items) {
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

  return [...resumen.values()].sort((a, b) =>
    a.producto.localeCompare(b.producto, "es-CL") || (a.presentacion ?? "").localeCompare(b.presentacion ?? "", "es-CL"),
  );
}

export async function obtenerPedidosAdmin(soloRecibidos: boolean) {
  const supabase = await crearClienteSupabaseServidor();
  let consulta = supabase
    .from("pedidos")
    .select("id,numero_pedido,nombre_cliente_snapshot,estado,total,fecha_creacion,fecha_entrega,preparacion_estado,subtotal_final,total_final")
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
    .select("id,fecha_entrega,total,total_final,preparacion_estado,cliente_id,estado")
    .not("fecha_entrega", "is", null)
    .gte("fecha_entrega", obtenerFechaLocalActual())
    .neq("estado", "cancelado")
    .order("fecha_entrega", { ascending: true });

  if (error) throw error;

  const pedidos = (data ?? []) as Array<{ id: string; fecha_entrega: string; total: number | string; total_final: number | string | null; preparacion_estado: PreparacionEstado | null; cliente_id: string | null; estado: EstadoPedidoAdmin }>;
  const entregas = new Map<string, EntregaAgrupadaAdmin>();
  const fechaPorPedido = new Map<string, string>();
  for (const pedido of pedidos) {
    if (!esEstadoIncluidoEnEntrega(pedido.estado)) continue;
    const existente = entregas.get(pedido.fecha_entrega) ?? {
      fecha: pedido.fecha_entrega,
      cantidadPedidos: 0,
      total: 0,
      cantidadClientes: 0,
      resumenProductos: [],
      cantidadPedidosIncompletos: 0,
    };
    existente.cantidadPedidos += 1;
    existente.total += Number(pedido.total_final ?? pedido.total);
    if (pedido.preparacion_estado === "incompleta") existente.cantidadPedidosIncompletos += 1;
    entregas.set(pedido.fecha_entrega, existente);
    fechaPorPedido.set(pedido.id, pedido.fecha_entrega);
  }

  const clientesPorFecha = new Map<string, Set<string>>();
  for (const pedido of pedidos) {
    if (!esEstadoIncluidoEnEntrega(pedido.estado)) continue;
    if (!pedido.cliente_id) continue;
    const clientes = clientesPorFecha.get(pedido.fecha_entrega) ?? new Set<string>();
    clientes.add(pedido.cliente_id);
    clientesPorFecha.set(pedido.fecha_entrega, clientes);
  }

  const itemsPorFecha = new Map<string, ItemPedidoEntregaFila[]>();
  const idsPedidos = [...fechaPorPedido.keys()];
  if (idsPedidos.length > 0) {
    const { data: items, error: errorItems } = await supabase
      .from("items_pedido")
      .select("id,pedido_id,producto_id,presentacion_producto_id,nombre_producto_snapshot,nombre_presentacion_snapshot,unidad_snapshot,cantidad")
      .in("pedido_id", idsPedidos);
    if (errorItems) throw errorItems;

    for (const item of (items ?? []) as ItemPedidoEntregaFila[]) {
      const fecha = fechaPorPedido.get(item.pedido_id);
      if (!fecha) continue;
      const itemsEntrega = itemsPorFecha.get(fecha) ?? [];
      itemsEntrega.push(item);
      itemsPorFecha.set(fecha, itemsEntrega);
    }
  }

  return [...entregas.values()].map((entrega) => ({
    ...entrega,
    cantidadClientes: clientesPorFecha.get(entrega.fecha)?.size ?? 0,
    resumenProductos: consolidarItemsEntrega(itemsPorFecha.get(entrega.fecha) ?? []),
  }));
}

export async function obtenerDetalleEntregaAdmin(fecha: string): Promise<DetalleEntregaAdmin> {
  const supabase = await crearClienteSupabaseServidor();
  const { data, error } = await supabase
    .from("pedidos")
    .select("id,numero_pedido,nombre_cliente_snapshot,estado,total,fecha_creacion,fecha_entrega,preparacion_estado,subtotal_final,total_final,cliente_id,destinatario_entrega_snapshot,zona_entrega_snapshot")
    .eq("fecha_entrega", fecha)
    .neq("estado", "cancelado")
    .order("fecha_creacion", { ascending: true });

  if (error) throw error;

  const filas = ((data ?? []) as PedidoEntregaFila[]).filter((pedido) => esEstadoIncluidoEnEntrega(pedido.estado));
  const pedidos: PedidoEntregaAdmin[] = filas.map((pedido) => ({
    ...mapPedidoListado(pedido),
    clienteId: pedido.cliente_id,
    destinatarioEntrega: pedido.destinatario_entrega_snapshot,
    zonaEntrega: pedido.zona_entrega_snapshot,
    items: [],
  }));
  const idsPedidos = pedidos.map((pedido) => pedido.id);

  let resumenProductos: readonly ResumenProductoEntrega[] = [];
  if (idsPedidos.length > 0) {
    const { data: items, error: errorItems } = await supabase
      .from("items_pedido")
      .select("id,pedido_id,producto_id,presentacion_producto_id,nombre_producto_snapshot,nombre_presentacion_snapshot,unidad_snapshot,cantidad,modo_cantidad_snapshot")
      .in("pedido_id", idsPedidos)
      .order("fecha_creacion", { ascending: true })
      .order("id", { ascending: true });
    if (errorItems) throw errorItems;

    const filasItems = (items ?? []) as ItemPedidoEntregaFila[];
    const preparacionPorItem = new Map<string, PreparacionItemFila>();
    if (filasItems.length > 0) {
      const { data: preparaciones, error: errorPreparaciones } = await supabase
        .from("preparacion_items_pedido")
        .select("item_pedido_id,cantidad_preparada,motivo_faltante")
        .in("item_pedido_id", filasItems.map((item) => item.id));
      if (errorPreparaciones) throw errorPreparaciones;
      for (const preparacion of (preparaciones ?? []) as PreparacionItemFila[]) {
        preparacionPorItem.set(preparacion.item_pedido_id, preparacion);
      }
    }

    const itemsPorPedido = new Map<string, ItemPreparacionPedidoAdmin[]>();
    for (const item of filasItems) {
      const preparacion = preparacionPorItem.get(item.id);
      const cantidadPreparada = preparacion ? Number(preparacion.cantidad_preparada) : null;
      const itemPreparacion: ItemPreparacionPedidoAdmin = {
        id: item.id,
        pedidoId: item.pedido_id,
        nombreProducto: item.nombre_producto_snapshot,
        nombrePresentacion: item.nombre_presentacion_snapshot,
        unidad: item.unidad_snapshot,
        cantidad: Number(item.cantidad),
        modoCantidadSnapshot: item.modo_cantidad_snapshot,
        cantidadPreparada,
        cantidadFaltante: Number(item.cantidad) - (cantidadPreparada ?? Number(item.cantidad)),
        motivoFaltante: preparacion?.motivo_faltante ?? null,
        tieneFaltante: cantidadPreparada !== null && cantidadPreparada < Number(item.cantidad),
      };
      const itemsPedido = itemsPorPedido.get(item.pedido_id) ?? [];
      itemsPedido.push(itemPreparacion);
      itemsPorPedido.set(item.pedido_id, itemsPedido);

    }

    resumenProductos = consolidarItemsEntrega(filasItems);

    for (const pedido of pedidos) {
      pedido.items = itemsPorPedido.get(pedido.id) ?? [];
    }
  }

  return {
    fecha,
    pedidos,
    resumenProductos,
    total: pedidos.reduce((acumulado, pedido) => acumulado + (pedido.totalFinal ?? pedido.total), 0),
    cantidadClientes: new Set(filas.flatMap((pedido) => pedido.cliente_id ? [pedido.cliente_id] : [])).size,
    resumenFaltantes: pedidos.flatMap((pedido) => pedido.preparacionEstado === "incompleta" ? pedido.items.filter((item) => item.tieneFaltante) : []),
  };
}

export async function obtenerPedidoAdmin(id: string): Promise<PedidoAdminDetalle | null> {
  const supabase = await crearClienteSupabaseServidor();
  const { data, error } = await supabase
    .from("pedidos")
    .select("id,numero_pedido,nombre_cliente_snapshot,estado,total,fecha_creacion,fecha_entrega,preparacion_estado,subtotal_final,total_final,canal_origen,telefono_cliente_snapshot,email_cliente_snapshot,direccion_snapshot,comuna_snapshot,region_snapshot,referencia_direccion_snapshot,destinatario_entrega_snapshot,telefono_contacto_entrega_snapshot,zona_entrega_snapshot,latitud_entrega_snapshot,longitud_entrega_snapshot,subtotal,costo_entrega,descuento,metodos_pago_previstos,observacion_general,items_pedido(id,nombre_producto_snapshot,nombre_presentacion_snapshot,unidad_snapshot,cantidad,precio_final_unitario_snapshot,total_linea,productos(ruta_imagen))")
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
    metodosPagoPrevistos: fila.metodos_pago_previstos as MetodoPagoPrevisto[] | null,
    observacionGeneral: fila.observacion_general,
    items: (fila.items_pedido ?? []).map((item) => ({
      id: item.id,
      nombreProductoSnapshot: item.nombre_producto_snapshot,
      nombrePresentacionSnapshot: item.nombre_presentacion_snapshot,
      unidadSnapshot: item.unidad_snapshot,
      rutaImagen: item.productos?.ruta_imagen ?? null,
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
  return unidad === "KG" ? `${texto} kg` : `${texto} ${cantidad === 1 ? "unidad" : "unidades"}`;
}

export function formatearCantidadPreparacion(item: Pick<ItemPreparacionPedidoAdmin, "cantidad" | "nombrePresentacion" | "unidad" | "modoCantidadSnapshot">) {
  return formatearCantidadPreparacionEntrega(item.cantidad, item.nombrePresentacion, item.unidad, item.modoCantidadSnapshot);
}
