import "server-only";

import { crearCartProductInput } from "@/lib/cart-product-input";
import { isValidCartQuantity } from "@/lib/cart-quantity";
import { getStorefrontProductsByPresentationIds } from "@/lib/storefront-catalog";
import { obtenerClienteActual } from "@/lib/account/identity";
import { crearClienteSupabaseServidor } from "@/lib/supabase/server";
import type { CartProductInput } from "@/types/cart";

export type EstadoPedidoCuenta =
  | "recibido"
  | "en_revision"
  | "confirmado"
  | "programado"
  | "preparando"
  | "listo_despacho"
  | "en_reparto"
  | "entregado"
  | "entrega_fallida"
  | "cancelado";

export type PedidoCuentaListado = {
  id: string;
  numeroPedido: string;
  estado: EstadoPedidoCuenta;
  fechaCreacion: string;
  total: number;
  cantidadLineas: number;
};

export type ItemPedidoCuenta = {
  id: string;
  nombreProductoSnapshot: string;
  nombrePresentacionSnapshot: string | null;
  unidadSnapshot: string;
  cantidad: number;
  precioFinalUnitarioSnapshot: number;
  totalLinea: number;
};

export type HistorialEstadoPedidoCuenta = {
  id: string;
  estadoAnterior: EstadoPedidoCuenta | null;
  estadoNuevo: EstadoPedidoCuenta;
  fechaCreacion: string;
  observacion: string | null;
};

export type PedidoCuentaDetalle = PedidoCuentaListado & {
  subtotal: number;
  costoEntrega: number;
  descuento: number;
  direccionSnapshot: string | null;
  comunaSnapshot: string | null;
  regionSnapshot: string | null;
  referenciaDireccionSnapshot: string | null;
  destinatarioEntrega: string | null;
  telefonoContactoEntrega: string | null;
  zonaEntrega: string | null;
  latitudEntrega: number | null;
  longitudEntrega: number | null;
  observacionGeneral: string | null;
  items: readonly ItemPedidoCuenta[];
  historial: readonly HistorialEstadoPedidoCuenta[];
};

export type MotivoLineaOmitidaRepeticion = "producto_no_disponible" | "presentacion_no_disponible" | "cantidad_invalida";

export type LineaRepetiblePedido = {
  itemPedidoId: string;
  item: CartProductInput;
  cantidad: number;
};

export type LineaOmitidaRepeticion = {
  itemPedidoId: string;
  nombreProductoSnapshot: string;
  motivo: MotivoLineaOmitidaRepeticion;
};

export type LineasRepetiblesPedido = {
  lineasValidas: readonly LineaRepetiblePedido[];
  lineasOmitidas: readonly LineaOmitidaRepeticion[];
};

type PedidoListadoFila = {
  id: string;
  numero_pedido: string;
  estado: EstadoPedidoCuenta;
  fecha_creacion: string;
  total: number | string;
  items_pedido: Array<{ id: string }> | null;
};

type PedidoDetalleFila = Omit<PedidoListadoFila, "items_pedido"> & {
  subtotal: number | string;
  costo_entrega: number | string;
  descuento: number | string;
  direccion_snapshot: string | null;
  comuna_snapshot: string | null;
  region_snapshot: string | null;
  referencia_direccion_snapshot: string | null;
  destinatario_entrega_snapshot: string | null;
  telefono_contacto_entrega_snapshot: string | null;
  zona_entrega_snapshot: string | null;
  latitud_entrega_snapshot: number | string | null;
  longitud_entrega_snapshot: number | string | null;
  observacion_general: string | null;
  items_pedido: Array<{
    id: string;
    nombre_producto_snapshot: string;
    nombre_presentacion_snapshot: string | null;
    unidad_snapshot: string;
    cantidad: number | string;
    precio_final_unitario_snapshot: number | string;
    total_linea: number | string;
  }> | null;
  historial_estados_pedido: Array<{
    id: string;
    estado_anterior: EstadoPedidoCuenta | null;
    estado_nuevo: EstadoPedidoCuenta;
    fecha_creacion: string;
    observacion: string | null;
  }> | null;
};

type ItemRepeticionFila = {
  id: string;
  producto_id: string | null;
  presentacion_producto_id: string | null;
  nombre_producto_snapshot: string;
  cantidad: number | string;
};

function mapPedidoListado(fila: PedidoListadoFila): PedidoCuentaListado {
  return {
    id: fila.id,
    numeroPedido: fila.numero_pedido,
    estado: fila.estado,
    fechaCreacion: fila.fecha_creacion,
    total: Number(fila.total),
    cantidadLineas: fila.items_pedido?.length ?? 0,
  };
}

export async function obtenerPedidosCuenta(): Promise<readonly PedidoCuentaListado[]> {
  const cliente = await obtenerClienteActual();
  if (!cliente) return [];

  const supabase = await crearClienteSupabaseServidor();
  const { data, error } = await supabase
    .from("pedidos")
    .select("id,numero_pedido,estado,fecha_creacion,total,items_pedido(id)")
    .eq("cliente_id", cliente.id)
    .order("fecha_creacion", { ascending: false });

  if (error) throw new Error("No fue posible cargar tus pedidos.");
  return (data as unknown as PedidoListadoFila[] ?? []).map(mapPedidoListado);
}

export async function obtenerPedidoCuenta(id: string): Promise<PedidoCuentaDetalle | null> {
  const cliente = await obtenerClienteActual();
  if (!cliente) return null;

  const supabase = await crearClienteSupabaseServidor();
  const { data, error } = await supabase
    .from("pedidos")
    .select("id,numero_pedido,estado,fecha_creacion,total,subtotal,costo_entrega,descuento,direccion_snapshot,comuna_snapshot,region_snapshot,referencia_direccion_snapshot,destinatario_entrega_snapshot,telefono_contacto_entrega_snapshot,zona_entrega_snapshot,latitud_entrega_snapshot,longitud_entrega_snapshot,observacion_general,items_pedido(id,nombre_producto_snapshot,nombre_presentacion_snapshot,unidad_snapshot,cantidad,precio_final_unitario_snapshot,total_linea),historial_estados_pedido(id,estado_anterior,estado_nuevo,fecha_creacion,observacion)")
    .eq("id", id)
    .eq("cliente_id", cliente.id)
    .maybeSingle();

  if (error) throw new Error("No fue posible cargar el pedido.");
  if (!data) return null;

  const fila = data as unknown as PedidoDetalleFila;
  return {
    ...mapPedidoListado(fila),
    subtotal: Number(fila.subtotal),
    costoEntrega: Number(fila.costo_entrega),
    descuento: Number(fila.descuento),
    direccionSnapshot: fila.direccion_snapshot,
    comunaSnapshot: fila.comuna_snapshot,
    regionSnapshot: fila.region_snapshot,
    referenciaDireccionSnapshot: fila.referencia_direccion_snapshot,
    destinatarioEntrega: fila.destinatario_entrega_snapshot,
    telefonoContactoEntrega: fila.telefono_contacto_entrega_snapshot,
    zonaEntrega: fila.zona_entrega_snapshot,
    latitudEntrega: fila.latitud_entrega_snapshot === null ? null : Number(fila.latitud_entrega_snapshot),
    longitudEntrega: fila.longitud_entrega_snapshot === null ? null : Number(fila.longitud_entrega_snapshot),
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
    historial: (fila.historial_estados_pedido ?? [])
      .map((item) => ({
        id: item.id,
        estadoAnterior: item.estado_anterior,
        estadoNuevo: item.estado_nuevo,
        fechaCreacion: item.fecha_creacion,
        observacion: item.observacion,
      }))
      .sort((first, second) => first.fechaCreacion.localeCompare(second.fechaCreacion)),
  };
}

export async function obtenerLineasRepetiblesPedido(id: string): Promise<LineasRepetiblesPedido | null> {
  const cliente = await obtenerClienteActual();
  if (!cliente) return null;

  const supabase = await crearClienteSupabaseServidor();
  const { data, error } = await supabase
    .from("pedidos")
    .select("items_pedido(id,producto_id,presentacion_producto_id,nombre_producto_snapshot,cantidad)")
    .eq("id", id)
    .eq("cliente_id", cliente.id)
    .maybeSingle();

  if (error) throw new Error("No fue posible preparar el pedido para repetir.");
  if (!data) return null;

  const itemsHistoricos = ((data as unknown as { items_pedido: ItemRepeticionFila[] | null }).items_pedido ?? []);
  const presentacionesIds = itemsHistoricos.flatMap((item) => item.presentacion_producto_id ? [item.presentacion_producto_id] : []);
  const productosActuales = await getStorefrontProductsByPresentationIds(presentacionesIds);
  const productosPorPresentacion = new Map(
    productosActuales.flatMap((product) => product.presentationId ? [[product.presentationId, product] as const] : []),
  );

  const lineasValidas: LineaRepetiblePedido[] = [];
  const lineasOmitidas: LineaOmitidaRepeticion[] = [];

  for (const itemHistorico of itemsHistoricos) {
    if (!itemHistorico.producto_id) {
      lineasOmitidas.push({ itemPedidoId: itemHistorico.id, nombreProductoSnapshot: itemHistorico.nombre_producto_snapshot, motivo: "producto_no_disponible" });
      continue;
    }
    if (!itemHistorico.presentacion_producto_id) {
      lineasOmitidas.push({ itemPedidoId: itemHistorico.id, nombreProductoSnapshot: itemHistorico.nombre_producto_snapshot, motivo: "presentacion_no_disponible" });
      continue;
    }

    const product = productosPorPresentacion.get(itemHistorico.presentacion_producto_id);
    const cartItem = product ? crearCartProductInput(product) : null;
    if (!cartItem) {
      lineasOmitidas.push({ itemPedidoId: itemHistorico.id, nombreProductoSnapshot: itemHistorico.nombre_producto_snapshot, motivo: "presentacion_no_disponible" });
      continue;
    }

    const cantidad = Number(itemHistorico.cantidad);
    if (!isValidCartQuantity(cartItem, cantidad)) {
      lineasOmitidas.push({ itemPedidoId: itemHistorico.id, nombreProductoSnapshot: itemHistorico.nombre_producto_snapshot, motivo: "cantidad_invalida" });
      continue;
    }

    lineasValidas.push({ itemPedidoId: itemHistorico.id, item: cartItem, cantidad });
  }

  return { lineasValidas, lineasOmitidas };
}
