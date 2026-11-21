import "server-only";

import { crearCartProductInput } from "@/lib/cart-product-input";
import { isValidCartQuantity } from "@/lib/cart-quantity";
import { getStorefrontProductsByPresentationIds } from "@/lib/storefront-catalog";
import { obtenerClienteActual } from "@/lib/account/identity";
import { crearClienteSupabaseServidor } from "@/lib/supabase/server";
import type { SnapshotVenta } from "@/lib/admin/correcciones-types";
import type { CartProductInput } from "@/types/cart";
import type { ModoCantidadSnapshot, PreparacionEstado } from "@/lib/order-preparation";
import type { MetodoPagoPrevisto } from "@/lib/payment-intent";

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
  fechaEntrega: string | null;
  total: number;
  totalFinal: number | null;
  preparacionEstado: PreparacionEstado | null;
  cantidadLineas: number;
  resumenProductos: string[];
};

export type ItemPedidoCuenta = {
  id: string;
  nombreProductoSnapshot: string;
  nombrePresentacionSnapshot: string | null;
  unidadSnapshot: string;
  modoCantidadSnapshot: ModoCantidadSnapshot | null;
  rutaImagen: string | null;
  cantidad: number;
  cantidadEntregada: number | null;
};

export type HistorialEstadoPedidoCuenta = {
  id: string;
  estadoAnterior: EstadoPedidoCuenta | null;
  estadoNuevo: EstadoPedidoCuenta;
  fechaCreacion: string;
  observacion: string | null;
};

export type PedidoCuentaDetalle = PedidoCuentaListado & {
  totalVentaDefinitiva: number | null;
  regimenContable: "legado" | "entrega_v1";
  metodosPagoPrevistos: readonly MetodoPagoPrevisto[] | null;
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
  fecha_entrega: string | null;
  total: number | string;
  total_final: number | string | null;
  preparacion_estado: PreparacionEstado | null;
  items_pedido: Array<{ id: string; nombre_producto_snapshot: string }> | null;
};

type PedidoDetalleFila = Omit<PedidoListadoFila, "items_pedido"> & {
  regimen_contable: PedidoCuentaDetalle["regimenContable"];
  total_venta_definitiva: SnapshotVenta["total"] | null;
  metodos_pago_previstos: string[] | null;
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
  productos_entrega: SnapshotVenta["productos"] | null;
  correcciones_venta_entregada: Array<Pick<SnapshotVenta, "productos" | "total">> | null;
  items_pedido: Array<{
    id: string;
    nombre_producto_snapshot: string;
    nombre_presentacion_snapshot: string | null;
    unidad_snapshot: string;
    modo_cantidad_snapshot: ModoCantidadSnapshot | null;
    productos: { ruta_imagen: string | null } | null;
    cantidad: number | string;
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
    fechaEntrega: fila.fecha_entrega,
    total: Number(fila.total),
    totalFinal: fila.total_final === null ? null : Number(fila.total_final),
    preparacionEstado: fila.preparacion_estado,
    cantidadLineas: fila.items_pedido?.length ?? 0,
    resumenProductos: (fila.items_pedido ?? []).slice(0, 3).map((item) => item.nombre_producto_snapshot),
  };
}

export async function obtenerPedidosCuenta(): Promise<readonly PedidoCuentaListado[]> {
  const cliente = await obtenerClienteActual();
  if (!cliente) return [];

  const supabase = await crearClienteSupabaseServidor();
  const { data, error } = await supabase
    .from("pedidos")
    .select("id,numero_pedido,estado,fecha_creacion,fecha_entrega,total,total_final,preparacion_estado,items_pedido(id,nombre_producto_snapshot)")
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
    .select("id,numero_pedido,estado,fecha_creacion,fecha_entrega,total,total_final,preparacion_estado,regimen_contable,metodos_pago_previstos,direccion_snapshot,comuna_snapshot,region_snapshot,referencia_direccion_snapshot,destinatario_entrega_snapshot,telefono_contacto_entrega_snapshot,zona_entrega_snapshot,latitud_entrega_snapshot,longitud_entrega_snapshot,observacion_general,total_venta_definitiva:venta_definitiva_snapshot->total,productos_entrega:venta_definitiva_snapshot->productos,correcciones_venta_entregada(total:nuevos->total,productos:nuevos->productos),items_pedido(id,nombre_producto_snapshot,nombre_presentacion_snapshot,unidad_snapshot,modo_cantidad_snapshot,cantidad,productos(ruta_imagen)),historial_estados_pedido(id,estado_anterior,estado_nuevo,fecha_creacion,observacion)")
    .eq("id", id)
    .eq("cliente_id", cliente.id)
    .order("version", { referencedTable: "correcciones_venta_entregada", ascending: false })
    .limit(1, { referencedTable: "correcciones_venta_entregada" })
    .maybeSingle();

  if (error) throw new Error("No fue posible cargar el pedido.");
  if (!data) return null;

  const fila = data as unknown as PedidoDetalleFila;
  const ultimaCorreccion = fila.correcciones_venta_entregada?.[0];
  const productosEntrega = ultimaCorreccion?.productos ?? fila.productos_entrega ?? [];
  const cantidadesEntregadas = new Map(productosEntrega.map((item) => [item.item_pedido_id, item.cantidad_entregada]));
  return {
    ...mapPedidoListado(fila),
    totalVentaDefinitiva: ultimaCorreccion?.total ?? fila.total_venta_definitiva,
    regimenContable: fila.regimen_contable,
    metodosPagoPrevistos: fila.metodos_pago_previstos as MetodoPagoPrevisto[] | null,
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
      modoCantidadSnapshot: item.modo_cantidad_snapshot,
      rutaImagen: item.productos?.ruta_imagen ?? null,
      cantidad: Number(item.cantidad),
      cantidadEntregada: cantidadesEntregadas.get(item.id) ?? null,
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
