import type { ResumenEntregaTodoCorrecto, SolicitudConCobro, BalanceEntrega } from "./entrega-actions";
const errorPrecio = "Esta cantidad requiere una regla de precio autorizada: el total administrativo no se puede prorratear. No se confirmó la entrega.";

// Vista previa de las reglas de 20261108150000. La RPC vuelve a valorarlas bajo locks.
// Multiplicación decimal exacta y redondeo positivo equivalente a numeric de PostgreSQL.
function valorar(cantidad: number, precio: unknown) {
  const texto = String(precio);
  if (!/^\d+(\.\d+)?$/.test(texto)) throw new Error("Precio inválido");
  const [entero, decimal = ""] = texto.split(".");
  const denominador = BigInt(1000) * BigInt(10) ** BigInt(decimal.length);
  const numerador = BigInt(Math.round(cantidad * 1000)) * BigInt(entero + decimal);
  return Number((numerador + denominador / BigInt(2)) / denominador);
}


export type DatosVistaEntrega = {
 resumen: ResumenEntregaTodoCorrecto;
 reglas: { id: string; cantidad: number; total_linea: number; total_final_administrativo: number | null; precio_final_unitario_snapshot: number | string; modo_cantidad_snapshot: string | null; nombre_presentacion_snapshot: string | null; unidad_snapshot: string }[];
 aplicadoPrevio: number;
};
export function valorarVistaEntrega(datos: DatosVistaEntrega, cantidades: Record<string, string>, diferencias: boolean): ResumenEntregaTodoCorrecto {
 if (!diferencias) return datos.resumen;
 let cambio = false;
 const productos = datos.resumen.productos.map(preparado => {
  const item = datos.reglas.find(i => i.id === preparado.id);
  if (!item) throw new Error("Faltan reglas de precio del producto.");
  const texto = cantidades[item.id] ?? "";
  const cantidad = Number(texto);
  const modo = item.modo_cantidad_snapshot ?? (/(saco|malla|caja|paquete|docena)/i.test(item.nombre_presentacion_snapshot ?? "") ? "presentacion_cerrada" : item.unidad_snapshot.trim().toUpperCase() === "KG" ? "kg_fraccionable" : "unidad");
  if (!/^\d+(\.\d{1,3})?$/.test(texto) || cantidad >= 1e9 || !["kg_fraccionable", "presentacion_cerrada", "unidad"].includes(modo) || !item.unidad_snapshot.trim() || (modo === "kg_fraccionable" && item.unidad_snapshot.trim().toUpperCase() !== "KG") || (modo !== "kg_fraccionable" && !Number.isInteger(cantidad))) throw new Error("Revisa las cantidades y unidades de los productos.");
  cambio ||= cantidad !== preparado.cantidad;
  let importe: number;
  if (cantidad === 0) importe = 0;
  else if (cantidad === preparado.cantidad) importe = preparado.importe;
  else if (cantidad === Number(item.cantidad)) importe = Number(item.total_linea);
  else if (item.total_final_administrativo !== null) throw new Error(errorPrecio);
  else importe = valorar(cantidad, item.precio_final_unitario_snapshot);
  if (!Number.isSafeInteger(importe) || importe < 0) throw new Error("Importe de producto inválido.");
  return { ...preparado, cantidad, importe };
 });
 if (!cambio) throw new Error("No hay diferencias. Selecciona Todo correcto.");
 const subtotal = productos.reduce((sum, i) => sum + i.importe, 0);
 const total = subtotal + datos.resumen.costoEntrega - datos.resumen.descuento;
 if (![subtotal, total].every(n => Number.isSafeInteger(n) && n >= 0)) throw new Error("El total no es válido; revisa cantidades y descuento.");
 return { ...datos.resumen, productos, subtotal, total, solicitud: { ...datos.resumen.solicitud, p_items: productos.map(i => ({ item_pedido_id: i.id, cantidad_entregada: i.cantidad })) } };
}
export function balanceVistaEntrega(total: number, aplicado: number, cobro: SolicitudConCobro["p_cobro"]): BalanceEntrega {
 const pendiente = total - aplicado;
 if (!Number.isSafeInteger(pendiente) || pendiente < 0) throw new Error("Los abonos anteriores superan la venta. Requiere revisión contable.");
 const recibido = cobro.efectivo + cobro.transferencia;
 return { deuda_pendiente: Math.max(pendiente - recibido, 0), saldo_a_favor_generado: Math.max(recibido - pendiente, 0) };
}
