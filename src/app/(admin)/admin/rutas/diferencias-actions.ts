"use server";

import { solicitudValida, cobroValido } from "./entrega-validacion";
import { mensajeErrorEntrega } from "./entrega-errores";
import { resolverEntrega } from "./entrega-confirmacion";
import { crearClienteSupabaseServidor } from "@/lib/supabase/server";
import { prepararEntregaTodoCorrecto, type SolicitudConCobro, type SolicitudEntregaTodoCorrecto, type ResumenEntregaTodoCorrecto, type BalanceEntrega } from "./entrega-actions";

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

export async function prepararEntregaDiferencias(s: SolicitudEntregaTodoCorrecto): Promise<{ resumen?: ResumenEntregaTodoCorrecto; error?: string }> {
  if (!solicitudValida(s)) return { error: "Revisa las cantidades: deben ser positivas o cero y tener hasta tres decimales." };
  try {
    // Incluye autenticación, permiso es_admin, estado, régimen, preparación y versión.
    const previa = await prepararEntregaTodoCorrecto(s.p_pedido_id, s.p_version_esperada);
    if (!previa.resumen) return { error: previa.error };
    const db = await crearClienteSupabaseServidor();
    const { data, error } = await db.from("items_pedido").select("id,cantidad,total_linea,total_final_administrativo,precio_final_unitario_snapshot,modo_cantidad_snapshot,nombre_presentacion_snapshot,unidad_snapshot").eq("pedido_id", s.p_pedido_id);
    if (error || !data || data.length !== s.p_items.length || data.some(i => !s.p_items.some(x => x.item_pedido_id === i.id))) return { error: "La lista debe incluir todos los productos del pedido." };
    let hayDiferencias = false;
    const productos = [];
    for (const preparado of previa.resumen.productos) {
      const item = data.find(i => i.id === preparado.id)!;
      const cantidad = s.p_items.find(i => i.item_pedido_id === preparado.id)!.cantidad_entregada;
      const modo = item.modo_cantidad_snapshot ?? (/(saco|malla|caja|paquete|docena)/i.test(item.nombre_presentacion_snapshot ?? "") ? "presentacion_cerrada" : String(item.unidad_snapshot).trim().toUpperCase() === "KG" ? "kg_fraccionable" : "unidad");
      if (!["kg_fraccionable", "presentacion_cerrada", "unidad"].includes(modo) || !String(item.unidad_snapshot ?? "").trim() || (modo === "kg_fraccionable" && String(item.unidad_snapshot).trim().toUpperCase() !== "KG")) return { error: "El formato o la unidad del producto requieren revisión." };
      if (modo !== "kg_fraccionable" && !Number.isInteger(cantidad)) return { error: "Las unidades y presentaciones cerradas requieren cantidades enteras." };
      hayDiferencias ||= cantidad !== preparado.cantidad;
      let importe: number;
      if (cantidad === 0) importe = 0;
      else if (cantidad === preparado.cantidad) importe = preparado.importe;
      else if (cantidad === Number(item.cantidad)) importe = Number(item.total_linea);
      else if (item.total_final_administrativo !== null) return { error: errorPrecio };
      else importe = valorar(cantidad, item.precio_final_unitario_snapshot);
      if (!Number.isSafeInteger(importe) || importe < 0) return { error: "El importe definitivo del producto no es válido." };
      productos.push({ ...preparado, cantidad, importe });
    }
    if (!hayDiferencias) return { error: "No hay diferencias. Usa Todo correcto si se entregó exactamente lo preparado." };
    const subtotal = productos.reduce((suma, i) => suma + i.importe, 0);
    const total = subtotal + previa.resumen.costoEntrega - previa.resumen.descuento;
    if (![subtotal, total].every(n => Number.isSafeInteger(n) && n >= 0)) return { error: "El total definitivo no es válido; revisa las cantidades y el descuento." };
    const { data: version, error: errorVersion } = await db.rpc("leer_preparacion_explicita", { p_pedido_id: s.p_pedido_id });
    if (errorVersion) return { error: mensajeErrorEntrega(errorVersion, "No fue posible verificar la versión operativa. Reintenta.") };
    if (Number(version?.version) !== s.p_version_esperada) return { error: "El pedido cambió durante la revisión. Cierra y revisa nuevamente." };
    return { resumen: { ...previa.resumen, productos, subtotal, total, solicitud: { p_pedido_id: s.p_pedido_id, p_version_esperada: s.p_version_esperada, p_clave: s.p_clave, p_items: s.p_items.map(i => ({ item_pedido_id: i.item_pedido_id, cantidad_entregada: i.cantidad_entregada })) } } };
  } catch { return { error: "No fue posible valorar la entrega. Reintenta sin confirmar." }; }
}

export async function revisarCobroDiferencias(s: SolicitudConCobro): Promise<{ balance?: BalanceEntrega; error?: string }> {
  if (!cobroValido(s)) return { error: "Revisa el método, los montos enteros CLP y la confirmación de Por pagar." };
  const previa = await prepararEntregaDiferencias(s);
  if (!previa.resumen) return { error: previa.error };
  try {
    const db = await crearClienteSupabaseServidor();
    const { data, error } = await db.from("aplicaciones_pago").select("monto_aplicado,pagos!inner(estado)").eq("pedido_id", s.p_pedido_id).eq("activa", true).eq("pagos.estado", "confirmado");
    if (error) return { error: mensajeErrorEntrega(error, "No fue posible consultar los abonos anteriores.") };
    const pendiente = previa.resumen.total - (data ?? []).reduce((sum, a) => sum + Number(a.monto_aplicado), 0);
    if (!Number.isSafeInteger(pendiente) || pendiente < 0) return { error: "Los abonos anteriores superan la venta. Requiere revisión contable; no se confirmó la entrega." };
    const recibido = s.p_cobro.efectivo + s.p_cobro.transferencia;
    return { balance: { deuda_pendiente: Math.max(pendiente - recibido, 0), saldo_a_favor_generado: Math.max(recibido - pendiente, 0) } };
  } catch { return { error: "No fue posible revisar los abonos. Reintenta." }; }
}

export async function confirmarEntregaDiferencias(s: SolicitudConCobro) {
  return resolverEntrega(s, true);
}
