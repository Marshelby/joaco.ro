import { normalizarMetodosPagoPrevistos, type MetodoPagoPrevisto } from "@/lib/payment-intent";
import type { FechaEntregaDisponible } from "@/types/delivery";
import { isValidCartQuantity } from "@/lib/cart-quantity";
import type { cargarCatalogoPedido } from "@/app/(admin)/admin/pedidos/nuevo/actions";

export type PresentacionPedido = Awaited<ReturnType<typeof cargarCatalogoPedido>>[number];
export type LineaPedidoBorrador = {
  presentacion: PresentacionPedido;
  cantidad: string;
  precioReferencia: number;
  totalFinal: string;
  motivoAjuste: string;
};

// Contrato serializable. crear_pedido_administrativo revalida catálogo,
// permisos y referencias y asigna actor y fecha de la auditoría en la base.
export type PedidoPreciosBorrador = {
  clienteId: string;
  ubicacionId: string;
  lineas: {
    productoId: string;
    presentacionId: string;
    cantidad: number;
    precioReferencia: number;
    totalFinal: number;
    motivoAjuste: string | null;
    totalOriginal: number;
  }[];
  subtotal: number;
};

export const IMPORTE_MAXIMO_PEDIDO = 9_000_000_000_000;

export function leerPrecioPedido(valor: string): number | null {
  if (!/^\d+$/.test(valor)) return null;
  const precio = Number(valor);
  return Number.isSafeInteger(precio) && precio <= IMPORTE_MAXIMO_PEDIDO ? precio : null;
}

export function totalLineaPedido(item: PresentacionPedido, cantidad: string, precio: number | null): number | null {
  const unidades = Number(cantidad);
  if (!cantidad.trim() || !isValidCartQuantity(item, unidades) || !Number.isSafeInteger(unidades * 2)
    || precio === null || !Number.isSafeInteger(precio) || precio < 0) return null;
  // Las cantidades admitidas son enteras o medios kilos. Redondeo al peso
  // por línea, igual que el contrato de cantidades, sin multiplicación decimal.
  const total = (BigInt(unidades * 2) * BigInt(precio) + BigInt(1)) / BigInt(2);
  return total <= BigInt(IMPORTE_MAXIMO_PEDIDO) ? Number(total) : null;
}

export function crearBorradorPrecios(clienteId: string, ubicacionId: string, lineas: LineaPedidoBorrador[], catalogo: PresentacionPedido[]): PedidoPreciosBorrador | null {
  if (!clienteId || !ubicacionId || !lineas.length) return null;
  const resultado: PedidoPreciosBorrador = { clienteId, ubicacionId, lineas: [], subtotal: 0 };
  const ids = new Set<string>();
  for (const linea of lineas) {
    const item = catalogo.find((actual) => actual.presentacionId === linea.presentacion.presentacionId && actual.productoId === linea.presentacion.productoId);
    const precio = leerPrecioPedido(linea.totalFinal);
    const original = item ? totalLineaPedido(item, linea.cantidad, item.precioFinalReferencia) : null;
    const total = precio;
    if (!item || precio === null || original === null || total === null || ids.has(item.presentacionId)
      || !Number.isSafeInteger(linea.precioReferencia) || linea.precioReferencia !== item.precioFinalReferencia
      || (precio !== original && !linea.motivoAjuste.trim()) || linea.motivoAjuste.length > 1000) return null;
    ids.add(item.presentacionId);
    resultado.lineas.push({ productoId: item.productoId, presentacionId: item.presentacionId, cantidad: Number(linea.cantidad), precioReferencia: linea.precioReferencia, totalFinal: precio, motivoAjuste: precio === original ? null : linea.motivoAjuste.trim(), totalOriginal: original });
    resultado.subtotal += total;
    if (!Number.isSafeInteger(resultado.subtotal) || resultado.subtotal > IMPORTE_MAXIMO_PEDIDO) return null;
  }
  return resultado;
}

export type PedidoBorrador = PedidoPreciosBorrador & {
  fechaEntrega: string;
  metodosPagoPrevistos: MetodoPagoPrevisto[];
};

// Pendiente de validar y aplicar la migración transaccional. Habilitación manual
// compartida por interfaz y servidor; no depende de datos enviados por el cliente.
export const CONFIRMACION_ADMINISTRATIVA_HABILITADA: boolean = false;

// Contrato de persistencia; no habilita por sí solo el envío.
// Conservar clave y documento completos al reintentar. El resultado es el
// comprobante original de creación, no el estado operativo actual del pedido.
export type CrearPedidoAdministrativoParametros = {
  p_clave_idempotencia: string;
  p_pedido: PedidoBorrador;
};

export type CrearPedidoAdministrativoResultado = {
  pedido_id: string;
  numero_pedido: string;
  estado: "recibido";
  subtotal: number;
  costo_entrega: number;
  descuento: number;
  total: number;
};

export type ConfirmarPedidoAdministrativoRespuesta =
  | { ok: true; pedido: CrearPedidoAdministrativoResultado; destino: string }
  | { ok: false; mensaje: string };

export function crearBorradorEntrega(precios: PedidoPreciosBorrador | null, fecha: string, metodos: readonly unknown[], disponibles: readonly FechaEntregaDisponible[]): PedidoBorrador | null {
  const normalizados = normalizarMetodosPagoPrevistos(metodos);
  if (!precios || !normalizados || !disponibles.some((item) => item.fecha === fecha)) return null;
  return { ...precios, fechaEntrega: fecha, metodosPagoPrevistos: normalizados };
}
