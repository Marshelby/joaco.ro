import type { ResumenEntregaTodoCorrecto, SolicitudConCobro, BalanceEntrega } from "./entrega-actions";
export const errorPrecio = "La cantidad ingresada requiere una regla de precio autorizada para esta línea.";

type AutorizacionPrecio = {
 precio_aplicado: number | null;
 precio_referencia: number | string;
 total_original: number | null;
 total_aplicado: number | null;
};

type ReglaEntrega = {
 id: string;
 cantidad: number;
 total_linea: number;
 total_final_administrativo: number | null;
 precio_final_unitario_snapshot: number | string;
 modo_cantidad_snapshot: string | null;
 nombre_presentacion_snapshot: string | null;
 unidad_snapshot: string;
 total_proporcional_autorizado?: boolean;
};

export const camposReglaEntrega = "id,cantidad,total_linea,total_final_administrativo,precio_final_unitario_snapshot,modo_cantidad_snapshot,nombre_presentacion_snapshot,unidad_snapshot,auditoria_precios_pedido_administrativo(precio_aplicado,precio_referencia,total_original,total_aplicado)";

function redondearImporte(numerador: bigint, denominador: bigint) {
 return Number((numerador * BigInt(2) + denominador) / (denominador * BigInt(2)));
}

function milesimas(cantidad: number) {
 return BigInt(Math.round(cantidad * 1000));
}

function valorar(cantidad: number, precio: unknown) {
 const texto = String(precio);
 if (!/^\d+(\.\d+)?$/.test(texto)) throw new Error("Precio inválido");
 const [entero, decimal = ""] = texto.split(".");
 return redondearImporte(milesimas(cantidad) * BigInt(entero + decimal), BigInt(1000) * BigInt(10) ** BigInt(decimal.length));
}

export function reglaEntregaAdmin(fila: ReglaEntrega & { auditoria_precios_pedido_administrativo: AutorizacionPrecio | AutorizacionPrecio[] | null }): ReglaEntrega {
 const { auditoria_precios_pedido_administrativo: relacion, ...item } = fila;
 const auditoria = Array.isArray(relacion) ? (relacion.length === 1 ? relacion[0] : null) : relacion;
 const cantidad = Number(item.cantidad);
 const total = item.total_final_administrativo;
 const referencia = Number(item.precio_final_unitario_snapshot);
 return {
  ...item,
  total_proporcional_autorizado: total !== null && Number.isSafeInteger(total) && total >= 0
   && total === item.total_linea && cantidad >= 0.001 && cantidad < 1e9
   && cantidad === Math.round(cantidad * 1000) / 1000
   && (Number.isInteger(cantidad) || modoCantidadEntrega(item) === "kg_fraccionable")
   && !!auditoria && auditoria.precio_aplicado === null
   && auditoria.total_aplicado === total && auditoria.total_original !== null
   && Number.isSafeInteger(auditoria.total_original) && auditoria.total_original >= 0
   && auditoria.total_original !== total && Number.isSafeInteger(referencia) && referencia > 0
   && Number(auditoria.precio_referencia) === referencia
   && auditoria.total_original === valorar(cantidad, item.precio_final_unitario_snapshot),
 };
}

export function importeLineaEntrega(item: ReglaEntrega, preparado: { cantidad: number; importe: number }, cantidad: number): number | null {
 if (cantidad === 0) return 0;
 if (cantidad === preparado.cantidad) return preparado.importe;
 const original = Number(item.cantidad);
 if (cantidad === original) return Number(item.total_linea);
 if (item.total_final_administrativo === null) return valorar(cantidad, item.precio_final_unitario_snapshot);
 if (!item.total_proporcional_autorizado || cantidad >= original) return null;
 return redondearImporte(milesimas(cantidad) * BigInt(item.total_final_administrativo), milesimas(original));
}

export function modoCantidadEntrega(item: ReglaEntrega) {
 return item.modo_cantidad_snapshot ?? (/(saco|malla|caja|paquete|docena)/i.test(item.nombre_presentacion_snapshot ?? "") ? "presentacion_cerrada" : item.unidad_snapshot.trim().toUpperCase() === "KG" ? "kg_fraccionable" : "unidad");
}

export function totalesEntrega(productos: { importe: number }[], costoEntrega: number, descuento: number) {
 if (![costoEntrega, descuento].every(n => Number.isSafeInteger(n) && n >= 0)) return null;
 const subtotal = productos.reduce((sum, i) => sum + BigInt(i.importe), BigInt(0));
 const total = subtotal + BigInt(costoEntrega) - BigInt(descuento);
 const limite = BigInt(Number.MAX_SAFE_INTEGER);
 if (subtotal > limite || total < BigInt(0) || total > limite) return null;
 return { subtotal: Number(subtotal), total: Number(total) };
}

export type DatosVistaEntrega = {
 resumen: ResumenEntregaTodoCorrecto;
 reglas: ReglaEntrega[];
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
  const modo = modoCantidadEntrega(item);
  if (!/^\d+(\.\d{1,3})?$/.test(texto) || cantidad >= 1e9 || !["kg_fraccionable", "presentacion_cerrada", "unidad"].includes(modo) || !item.unidad_snapshot.trim() || (modo === "kg_fraccionable" && item.unidad_snapshot.trim().toUpperCase() !== "KG") || (modo !== "kg_fraccionable" && !Number.isInteger(cantidad))) throw new Error("Revisa las cantidades y unidades de los productos.");
  cambio ||= cantidad !== preparado.cantidad;
  const importe = importeLineaEntrega(item, preparado, cantidad);
  if (importe === null) throw new Error(errorPrecio);
  if (!Number.isSafeInteger(importe) || importe < 0) throw new Error("Importe de producto inválido.");
  return { ...preparado, cantidad, importe };
 });
 if (!cambio) throw new Error("No hay diferencias. Selecciona Todo correcto.");
 const totales = totalesEntrega(productos, datos.resumen.costoEntrega, datos.resumen.descuento);
 if (!totales) throw new Error("El total no es válido; revisa cantidades y descuento.");
 return { ...datos.resumen, productos, ...totales, solicitud: { ...datos.resumen.solicitud, p_items: productos.map(i => ({ item_pedido_id: i.id, cantidad_entregada: i.cantidad })) } };
}
export function balanceVistaEntrega(total: number, aplicado: number, cobro: SolicitudConCobro["p_cobro"]): BalanceEntrega {
 const pendiente = total - aplicado;
 if (!Number.isSafeInteger(pendiente) || pendiente < 0) throw new Error("Los abonos anteriores superan la venta. Requiere revisión contable.");
 const recibido = cobro.efectivo + cobro.transferencia;
 return { deuda_pendiente: Math.max(pendiente - recibido, 0), saldo_a_favor_generado: Math.max(recibido - pendiente, 0) };
}
