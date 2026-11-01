import { z } from "zod";
import { normalizarTelefonoWhatsapp } from "@/lib/whatsapp";

export const fechaISO = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((valor) => {
  const fecha = new Date(`${valor}T12:00:00Z`);
  return Number.isFinite(fecha.getTime()) && fecha.toISOString().slice(0, 10) === valor;
});
export const itemSolicitud = z.strictObject({ presentacion_id: z.uuid().transform((id) => id.toLowerCase()), cantidad: z.number().finite().positive().max(100000) });
export const datosSolicitud = z.strictObject({
  nombre: z.string().trim().min(1).max(160),
  telefono: z.string().trim().max(40).transform(normalizarTelefonoWhatsapp).refine((valor) => valor !== null),
  fecha: fechaISO,
  observaciones: z.string().trim().max(2000),
  items: z.array(itemSolicitud).min(1).max(100).refine((items) => new Set(items.map((i) => i.presentacion_id)).size === items.length),
});
export const payloadSolicitud = datosSolicitud.extend({
  solicitudClave: z.uuid().optional(), solicitudSecreto: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  claveIdempotencia: z.uuid(), secretoReintento: z.string().regex(/^[a-f0-9]{64}$/),
});
export const respuestaSolicitud = z.object({
  version_solicitud: z.number().int().min(1).max(5).default(1), codigo_solicitud: z.string().optional(),
  codigo: z.string().regex(/^PP-[a-f0-9]{32}$/), fecha_solicitada: fechaISO,
  subtotal: z.number().int().nonnegative(), despacho: z.number().int().nonnegative(), total: z.number().int().nonnegative(),
  moneda: z.literal("CLP"), estado: z.literal("registrado"),
  items: z.array(z.object({ producto: z.string(), presentacion: z.string(), unidad: z.string(), cantidad: z.number(), precio_unitario: z.number(), subtotal: z.number() })).min(1).max(100),
});
export type DatosSolicitud = z.infer<typeof datosSolicitud>;
export type PayloadSolicitud = z.infer<typeof payloadSolicitud>;
export type RespuestaSolicitud = z.infer<typeof respuestaSolicitud>;

const errores: Record<string, string> = {
  LIMITE_VERSIONES: "Esta solicitud ya tiene cinco versiones. Contacta a Hidro Leufú.",
  NO_AUTORIZADO: "Tu sesión no tiene permisos para esta operación.",
  POSIBLE_PEDIDO_DESACTUALIZADO: "Otra persona actualizó esta solicitud. Actualiza la página antes de continuar.",
  POSIBLE_PEDIDO_CERRADO: "Esta solicitud ya está cerrada. Actualiza la página para ver su estado.",
  POSIBLE_PEDIDO_NO_ENCONTRADO: "La solicitud ya no está disponible.",
  CLAVE_OPERACION_EN_USO: "Esta operación ya fue utilizada. Actualiza la solicitud antes de continuar.",
  REINTENTO_INVALIDO: "Este intento corresponde a otros datos. Recupera la solicitud pendiente antes de crear otra.",
  FECHA_FUERA_DE_OPCIONES: "La fecha elegida ya no está disponible. Actualiza las fechas y vuelve a intentar.",
  FECHA_ENTREGA_NO_DISPONIBLE: "La fecha elegida ya no está disponible. Selecciona otra fecha.",
  PRODUCTO_NO_DISPONIBLE: "Un producto ya no está disponible. Revisa tu carrito.",
  PRESENTACION_NO_DISPONIBLE: "Una presentación ya no está disponible. Revisa los productos.",
  CATEGORIA_NO_DISPONIBLE: "Un producto ya no está disponible. Revisa los productos.",
  PRESENTACION_MODIFICADA_REQUIERE_REVISION: "Cambió el formato de un producto. Revisa su presentación antes de convertir.",
  PRESENTACION_EXISTENTE_USAR_ITEM_ID: "Reactiva la línea original para conservar su precio histórico.",
  CANTIDAD_INVALIDA: "Revisa las cantidades y los formatos de los productos.",
  PRECIO_O_MOTIVO_INVALIDO: "Revisa los precios e indica el motivo de la autorización.",
  MOTIVO_REQUERIDO: "Indica el motivo de esta operación.",
  CLIENTE_INVALIDO: "Asocia un cliente comercial activo antes de continuar.",
  DIRECCION_INVALIDA: "Selecciona una dirección activa del cliente asociado.",
  DIRECCION_SIN_UBICACION: "La dirección necesita una ubicación válida.",
  ZONA_INVALIDA: "La zona de entrega ya no está habilitada.",
  METODOS_PAGO_INVALIDOS: "Selecciona una forma de pago válida.",
};
export function mensajeErrorPosiblePedido(codigo?: string) {
  return errores[codigo ?? ""] ?? "No pudimos completar la operación. Conserva los datos y vuelve a intentarlo.";
}
