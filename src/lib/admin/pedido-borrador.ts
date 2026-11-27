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
  if (!cantidad.trim() || unidades > 100000 || !isValidCartQuantity(item, unidades)
    || precio === null || !Number.isSafeInteger(precio) || precio < 0 || precio > IMPORTE_MAXIMO_PEDIDO) return null;
  // Redondear al peso por línea con aritmética entera, igual que el RPC.
  const milesimas = BigInt(Math.round(unidades * 1000));
  const total = (milesimas * BigInt(precio) + BigInt(500)) / BigInt(1000);
  return total <= BigInt(IMPORTE_MAXIMO_PEDIDO) ? Number(total) : null;
}

export function leerAjusteTotalLinea(linea: LineaPedidoBorrador, totalOriginal: number | null) {
  const totalFinal = leerPrecioPedido(linea.totalFinal);
  const motivo = linea.motivoAjuste.trim();
  if (totalOriginal === null || totalFinal === null || linea.motivoAjuste.length > 1000
    || (totalFinal !== totalOriginal && !motivo)) return null;
  return { totalOriginal, totalFinal, motivoAjuste: totalFinal === totalOriginal ? null : motivo };
}

export function crearBorradorPrecios(clienteId: string, ubicacionId: string, lineas: LineaPedidoBorrador[], catalogo: PresentacionPedido[]): PedidoPreciosBorrador | null {
  if (!clienteId || !ubicacionId || !lineas.length || lineas.length > 100) return null;
  const resultado: PedidoPreciosBorrador = { clienteId, ubicacionId, lineas: [], subtotal: 0 };
  const ids = new Set<string>();
  for (const linea of lineas) {
    const item = catalogo.find((actual) => actual.presentacionId === linea.presentacion.presentacionId && actual.productoId === linea.presentacion.productoId);
    const ajuste = leerAjusteTotalLinea(linea, item ? totalLineaPedido(item, linea.cantidad, item.precioFinalReferencia) : null);
    if (!item || !ajuste || item.precioFinalReferencia <= 0 || ids.has(item.presentacionId)
      || !Number.isSafeInteger(linea.precioReferencia) || linea.precioReferencia !== item.precioFinalReferencia) return null;
    ids.add(item.presentacionId);
    resultado.lineas.push({ productoId: item.productoId, presentacionId: item.presentacionId, cantidad: Number(linea.cantidad), precioReferencia: linea.precioReferencia, ...ajuste });
    resultado.subtotal += ajuste.totalFinal;
    if (!Number.isSafeInteger(resultado.subtotal) || resultado.subtotal > IMPORTE_MAXIMO_PEDIDO) return null;
  }
  return resultado;
}

export type PedidoBorrador = PedidoPreciosBorrador & {
  fechaEntrega: string;
  metodosPagoPrevistos: MetodoPagoPrevisto[];
};

// Contrato auditado contra 20261105020000 y su adaptación 20261105030000.
// Habilitación compartida por interfaz y servidor.
export const CONFIRMACION_ADMINISTRATIVA_HABILITADA: boolean = true;

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
  | { ok: false; mensaje: string; resultadoIncierto?: boolean };

export function crearBorradorEntrega(precios: PedidoPreciosBorrador | null, fecha: string, metodos: readonly unknown[], disponibles: readonly FechaEntregaDisponible[]): PedidoBorrador | null {
  const normalizados = normalizarMetodosPagoPrevistos(metodos);
  if (!precios || !normalizados || !disponibles.some((item) => item.fecha === fecha)) return null;
  return { ...precios, fechaEntrega: fecha, metodosPagoPrevistos: normalizados };
}
