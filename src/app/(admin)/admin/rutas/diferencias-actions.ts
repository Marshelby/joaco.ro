"use server";

import { revalidatePath } from "next/cache";
import { crearClienteSupabaseServidor } from "@/lib/supabase/server";
import { prepararEntregaTodoCorrecto, type SolicitudConCobro, type SolicitudEntregaTodoCorrecto, type ResumenEntregaTodoCorrecto, type BalanceEntrega } from "./entrega-actions";

const uuid = (v: unknown) => typeof v === "string" && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(v);
function solicitudValida(s: SolicitudEntregaTodoCorrecto) {
  return s && uuid(s.p_pedido_id) && uuid(s.p_clave) && Number.isSafeInteger(s.p_version_esperada) && s.p_version_esperada >= 0 && s.p_version_esperada < Number.MAX_SAFE_INTEGER &&
    Array.isArray(s.p_items) && s.p_items.length > 0 && new Set(s.p_items.map(i => i?.item_pedido_id)).size === s.p_items.length &&
    s.p_items.every(i => i && uuid(i.item_pedido_id) && typeof i.cantidad_entregada === "number" && Number.isFinite(i.cantidad_entregada) && i.cantidad_entregada >= 0 && i.cantidad_entregada < 1e9 && /^\d+(\.\d{1,3})?$/.test(String(i.cantidad_entregada)));
}
function cobroValido(s: SolicitudConCobro) {
  const c = s?.p_cobro;
  return c && [c.efectivo, c.transferencia, c.efectivo + c.transferencia].every(n => Number.isSafeInteger(n) && n >= 0) &&
    ((c.metodo === "por_pagar" && c.confirmar_por_pagar === true && c.efectivo === 0 && c.transferencia === 0) ||
    (c.confirmar_por_pagar === false && ((c.metodo === "efectivo" && c.efectivo > 0 && c.transferencia === 0) ||
    (c.metodo === "transferencia" && c.transferencia > 0 && c.efectivo === 0) || (c.metodo === "ambos" && c.efectivo > 0 && c.transferencia > 0))));
}
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
    if (errorVersion || Number(version?.version) !== s.p_version_esperada) return { error: "El pedido cambió durante la revisión. Cierra y revisa nuevamente." };
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
    if (error) return { error: "No fue posible consultar los abonos anteriores." };
    const pendiente = previa.resumen.total - (data ?? []).reduce((sum, a) => sum + Number(a.monto_aplicado), 0);
    if (!Number.isSafeInteger(pendiente) || pendiente < 0) return { error: "Los abonos anteriores superan la venta. Requiere revisión contable; no se confirmó la entrega." };
    const recibido = s.p_cobro.efectivo + s.p_cobro.transferencia;
    return { balance: { deuda_pendiente: Math.max(pendiente - recibido, 0), saldo_a_favor_generado: Math.max(recibido - pendiente, 0) } };
  } catch { return { error: "No fue posible revisar los abonos. Reintenta." }; }
}

export async function confirmarEntregaDiferencias(s: SolicitudConCobro): Promise<{ resultado?: BalanceEntrega; error?: string }> {
  if (!solicitudValida(s) || !cobroValido(s)) return { error: "Los datos de entrega o cobro no son válidos." };
  let resultado: BalanceEntrega;
  try {
    const db = await crearClienteSupabaseServidor();
    const { data: sesion, error: errorSesion } = await db.auth.getUser();
    if (errorSesion || !sesion.user) return { error: "Tu sesión expiró. Inicia sesión y reintenta con la misma solicitud." };
    const { data: admin, error: errorAdmin } = await db.rpc("es_admin");
    if (errorAdmin || admin !== true) return { error: "No tienes permisos para confirmar entregas." };
    // No releer ni exigir la versión actual antes de la RPC: debe poder resolver reintentos ya confirmados.
    const { data, error } = await db.rpc("confirmar_entrega_hubo_diferencias", {
      p_pedido_id: s.p_pedido_id, p_version_esperada: s.p_version_esperada, p_clave: s.p_clave,
      p_items: s.p_items.map(i => ({ item_pedido_id: i.item_pedido_id, cantidad_entregada: i.cantidad_entregada })),
      p_cobro: { metodo: s.p_cobro.metodo, efectivo: s.p_cobro.efectivo, transferencia: s.p_cobro.transferencia, confirmar_por_pagar: s.p_cobro.confirmar_por_pagar },
    });
    if (error) {
      const mensajes: Record<string, string> = {
        TOTAL_ADMINISTRATIVO_SIN_REGLA_PARA_CANTIDAD_ENTREGADA: errorPrecio,
        NO_AUTORIZADO: "No tienes permisos para confirmar entregas.",
        VERSION_OPERATIVA_CONFLICTO: "El pedido cambió. No se confirmó esta solicitud. Revisa el pedido.",
        CLAVE_IDEMPOTENCIA_EN_USO: "La clave pertenece a otra solicitud. No se confirmó esta entrega.",
        ESTADO_PEDIDO_INVALIDO: "El pedido ya no está disponible para entregar. Revisa su estado.",
        APLICACIONES_PREVIAS_SUPERAN_VENTA: "Los abonos anteriores superan la venta. Requiere revisión contable; no se confirmó la entrega.",
        ENTREGA_SIN_DIFERENCIAS: "No hay diferencias respecto de la preparación. Usa Todo correcto.",
        CANTIDAD_ENTREGADA_DEBE_SER_ENTERA: "Las unidades y presentaciones cerradas requieren cantidades enteras.",
        CANTIDAD_ENTREGADA_INVALIDA: "Revisa las cantidades: máximo tres decimales y valores menores a mil millones.",
      };
      return { error: mensajes[error.message] ?? "El servidor rechazó la entrega o el cobro. No se confirmó esta solicitud. Reintenta con los mismos datos o revisa el pedido." };
    }
    if (!data?.resultado) return { error: "No se pudo verificar la respuesta. Reintenta con la misma solicitud." };
    resultado = data.resultado;
  } catch { return { error: "No se pudo verificar la respuesta. Reintenta con la misma solicitud para evitar duplicados." }; }
  try {
    revalidatePath("/admin/rutas");
    revalidatePath("/admin/pedidos");
    revalidatePath(`/admin/pedidos/${s.p_pedido_id}/historial`);
  } catch { /* El cliente también actualiza la ruta tras el éxito. */ }
  return { resultado };
}
