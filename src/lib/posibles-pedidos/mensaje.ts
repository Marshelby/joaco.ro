import { formatCLP } from "@/lib/formatters";
import { formatFechaEntregaLarga } from "@/lib/delivery-date";
import { crearEnlaceWhatsapp } from "@/lib/whatsapp";
import type { DatosSolicitud, RespuestaSolicitud } from "./contrato";

export function mensajeSolicitud(datos: DatosSolicitud, respuesta: RespuestaSolicitud) {
  return [
    "Hola, quisiera coordinar esta solicitud con Hidro Leufú.",
    `Referencia: ${respuesta.codigo_solicitud ?? respuesta.codigo} · Versión ${respuesta.version_solicitud}`,
    `Nombre: ${datos.nombre}`,
    `Teléfono: +${datos.telefono}`,
    `Entrega solicitada: ${formatFechaEntregaLarga(respuesta.fecha_solicitada)}`,
    "", ...respuesta.items.map((i) => `• ${i.producto} · ${i.presentacion} (${i.unidad}) · ${i.cantidad} × ${formatCLP(i.precio_unitario)} = ${formatCLP(i.subtotal)}`),
    "", `Subtotal: ${formatCLP(respuesta.subtotal)}`, `Despacho: ${formatCLP(respuesta.despacho)}`,
    `Total referencial: ${formatCLP(respuesta.total)}`,
    `Ubicación y observaciones: ${datos.observaciones || "Sin observaciones"}`,
    "", "Solicitud registrada, pendiente de confirmación por Hidro Leufú. No es un pedido oficialmente aceptado.",
  ].join("\n");
}
export function enlaceSolicitud(datos: DatosSolicitud, respuesta: RespuestaSolicitud) {
  return crearEnlaceWhatsapp("+56954878711", mensajeSolicitud(datos, respuesta))!;
}
