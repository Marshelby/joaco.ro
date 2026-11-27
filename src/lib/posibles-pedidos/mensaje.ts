import { formatFechaEntregaLarga } from "@/lib/delivery-date";
import { crearEnlaceWhatsapp } from "@/lib/whatsapp";
import type { DatosSolicitud, RespuestaSolicitud } from "./contrato";

export function mensajeSolicitud(datos: DatosSolicitud, respuesta: RespuestaSolicitud) {
  return [
    "Hola, Hidro Leufu. Quisiera realizar el siguiente pedido.",
    "",
    `*Nombre:* ${datos.nombre}`,
    `*Teléfono:* +${datos.telefono}`,
    `*Fecha de entrega:* ${formatFechaEntregaLarga(respuesta.fecha_solicitada)}`,
    datos.observaciones.replace(/^Localidad:/, "*Localidad:*") || "*Localidad:* Sin especificar",
    "", "*Productos:*",
    ...respuesta.items.map((i) => `• *${i.producto}* · ${i.cantidad} ${i.unidad} (${i.presentacion})`),
    "", "Quedo esperando la confirmacion de mi pedido. ¡Gracias!",
  ].join("\n");
}
export function enlaceSolicitud(datos: DatosSolicitud, respuesta: RespuestaSolicitud) {
  return crearEnlaceWhatsapp("+56954878711", mensajeSolicitud(datos, respuesta))!;
}
