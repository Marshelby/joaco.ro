import { z } from "zod";
import { fechaISO } from "./contrato";
const base = { id: z.uuid(), version: z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER), clave: z.uuid() };
const cantidad = z.number().finite().positive().max(100000);
export const lineasEdicion = z.array(z.union([
  z.strictObject({ item_id: z.uuid(), cantidad }), z.strictObject({ presentacion_id: z.uuid(), cantidad }),
])).min(1).max(100);
export const operacionAdmin = z.discriminatedUnion("tipo", [
  z.strictObject({ ...base, tipo: z.literal("editar"), lineas: lineasEdicion }),
  z.strictObject({ ...base, tipo: z.literal("asociar"), cliente: z.uuid() }),
  z.strictObject({ ...base, tipo: z.literal("precio"), item: z.uuid(), neto: z.coerce.number().int().nonnegative().max(9000000000000), venta: z.coerce.number().int().nonnegative().max(9000000000000), motivo: z.string().trim().min(1).max(1000) }),
  z.strictObject({ ...base, tipo: z.literal("descartar"), motivo: z.string().trim().min(1).max(1000) }),
  z.strictObject({ ...base, tipo: z.literal("convertir"), direccion: z.uuid(), fecha: fechaISO, metodo: z.enum(["efectivo","transferencia","tarjeta"]), confirmacion: z.literal("on") }),
]);
export function parametrosOperacion(valor: z.infer<typeof operacionAdmin>) {
  const comunes = { p_id: valor.id, p_version_esperada: valor.version, p_clave_operacion: valor.clave };
  switch (valor.tipo) {
    case "editar": return { rpc: "editar_posible_pedido_administrativo", args: { ...comunes, p_lineas: valor.lineas } };
    case "asociar": return { rpc: "asociar_cliente_posible_pedido", args: { ...comunes, p_cliente_id: valor.cliente } };
    case "precio": return { rpc: "autorizar_precio_posible_pedido", args: { ...comunes, p_item_id: valor.item, p_precio_neto: valor.neto, p_precio_venta: valor.venta, p_motivo: valor.motivo } };
    case "descartar": return { rpc: "descartar_posible_pedido", args: { ...comunes, p_motivo: valor.motivo } };
    case "convertir": return { rpc: "convertir_posible_pedido_administrativo", args: { ...comunes, p_direccion_id: valor.direccion, p_fecha_efectiva: valor.fecha, p_metodos_pago: [valor.metodo] } };
  }
}
