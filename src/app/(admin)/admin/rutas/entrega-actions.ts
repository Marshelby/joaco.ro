"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { crearClienteSupabaseServidor } from "@/lib/supabase/server";

// Contrato vigente de 20261108140000: entrega y cobro atómicos.
// Conservar clave, versión, contenido Y orden de p_items para cualquier reintento.
export type SolicitudEntregaTodoCorrecto = {
  p_pedido_id: string;
  p_version_esperada: number;
  p_clave: string;
  p_items: { item_pedido_id: string; cantidad_entregada: number }[];
};
export type ResumenEntregaTodoCorrecto = {
  solicitud: SolicitudEntregaTodoCorrecto;
  productos: { id: string; nombre: string; presentacion: string | null; unidad: string; cantidad: number; importe: number }[];
  subtotal: number;
  costoEntrega: number;
  descuento: number;
  total: number;
};

// Solo prepara una vista previa. No es una confirmación ni un snapshot persistido.

export async function prepararEntregaTodoCorrecto(pedidoId: string, versionEsperada: number): Promise<{
  resumen?: ResumenEntregaTodoCorrecto; error?: string;
}> {
  if (typeof pedidoId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(pedidoId) ||
    !Number.isSafeInteger(versionEsperada) || versionEsperada < 0 || versionEsperada >= Number.MAX_SAFE_INTEGER) {
    return { error: "Recarga el pedido antes de revisar la entrega." };
  }
  try {
    const db = await crearClienteSupabaseServidor();
    const { data: sesion, error: errorSesion } = await db.auth.getUser();
    if (errorSesion || !sesion.user) return { error: "Tu sesión expiró. Inicia sesión nuevamente." };
    const { data: admin, error: errorAdmin } = await db.rpc("es_admin");
    if (errorAdmin || admin !== true) return { error: "No tienes permisos para revisar esta entrega." };
    const { data: antes, error: errorAntes } = await db.rpc("leer_preparacion_explicita", { p_pedido_id: pedidoId });
    if (errorAntes || Number(antes?.version) !== versionEsperada) return { error: "El pedido cambió. Recarga antes de continuar." };
    const { data: pedido, error: errorPedido } = await db.from("pedidos")
      .select("estado,regimen_contable,preparacion_finalizada_en,venta_definitiva_snapshot,total_operativo_preparacion,costo_entrega,descuento")
      .eq("id", pedidoId).single();
    if (errorPedido || !pedido || pedido.regimen_contable !== "entrega_v1" || pedido.estado !== "en_reparto" ||
      !pedido.preparacion_finalizada_en || pedido.venta_definitiva_snapshot !== null) {
      return { error: "Este pedido no admite la entrega Todo correcto: requiere entrega_v1, preparación finalizada y estado en reparto." };
    }
    const { data: items, error: errorItems } = await db.from("items_pedido")
      .select("id,nombre_producto_snapshot,nombre_presentacion_snapshot,unidad_snapshot")
      .eq("pedido_id", pedidoId).order("id");
    const { data: preparaciones, error: errorPreparaciones } = await db.from("preparacion_items_pedido")
      .select("item_pedido_id,cantidad_preparada,importe_linea_operativo,confirmado_explicito")
      .eq("pedido_id", pedidoId).order("item_pedido_id");
    if (errorItems || errorPreparaciones || !items?.length || !preparaciones) return { error: "No fue posible leer la preparación completa." };
    const productos: ResumenEntregaTodoCorrecto["productos"] = [];
    for (const item of items) {
      const preparado = preparaciones.find((fila) => fila.item_pedido_id === item.id);
      const cantidad = Number(preparado?.cantidad_preparada);
      const importe = Number(preparado?.importe_linea_operativo);
      if (!preparado?.confirmado_explicito || preparado.cantidad_preparada == null || preparado.importe_linea_operativo == null ||
        !Number.isFinite(cantidad) || cantidad < 0 || !Number.isSafeInteger(importe) || importe < 0) {
        return { error: "Todos los productos deben tener cantidad e importe de preparación confirmados explícitamente." };
      }
      productos.push({ id: item.id, nombre: item.nombre_producto_snapshot, presentacion: item.nombre_presentacion_snapshot,
        unidad: item.unidad_snapshot, cantidad, importe });
    }
    const subtotal = productos.reduce((suma, item) => suma + item.importe, 0);
    const costoEntrega = Number(pedido.costo_entrega);
    const descuento = Number(pedido.descuento);
    const total = subtotal + costoEntrega - descuento;
    if (pedido.total_operativo_preparacion == null || ![subtotal, costoEntrega, descuento, total].every((importe) => Number.isSafeInteger(importe) && importe >= 0) ||
      total !== Number(pedido.total_operativo_preparacion)) return { error: "Los importes de preparación no coinciden. Recarga el pedido." };
    const { data: despues, error: errorDespues } = await db.rpc("leer_preparacion_explicita", { p_pedido_id: pedidoId });
    if (errorDespues || Number(despues?.version) !== versionEsperada) return { error: "El pedido cambió durante la revisión. Recarga antes de continuar." };
    return { resumen: { productos, subtotal, costoEntrega, descuento, total, solicitud: {
      p_pedido_id: pedidoId, p_version_esperada: versionEsperada, p_clave: randomUUID(),
      p_items: productos.map((item) => ({ item_pedido_id: item.id, cantidad_entregada: item.cantidad })),
    } } };
  } catch {
    return { error: "No fue posible preparar el resumen. Reintenta sin confirmar la entrega." };
  }
}

export type CobroEntrega = {
  metodo: "efectivo" | "transferencia" | "ambos" | "por_pagar";
  efectivo: number;
  transferencia: number;
  confirmar_por_pagar: boolean;
};
export type SolicitudConCobro = SolicitudEntregaTodoCorrecto & { p_cobro: CobroEntrega };
export type BalanceEntrega = { deuda_pendiente: number; saldo_a_favor_generado: number };

function cobroValido(c: CobroEntrega) {
  return c && [c.efectivo, c.transferencia, c.efectivo + c.transferencia].every(n => Number.isSafeInteger(n) && n >= 0) &&
    ((c.metodo === "por_pagar" && c.confirmar_por_pagar === true && c.efectivo === 0 && c.transferencia === 0) ||
    (c.confirmar_por_pagar === false && ((c.metodo === "efectivo" && c.efectivo > 0 && c.transferencia === 0) ||
      (c.metodo === "transferencia" && c.transferencia > 0 && c.efectivo === 0) ||
      (c.metodo === "ambos" && c.efectivo > 0 && c.transferencia > 0))));
}

export async function revisarCobroEntrega(s: SolicitudConCobro): Promise<{ balance?: BalanceEntrega; error?: string }> {
  if (!cobroValido(s.p_cobro)) return { error: "Revisa los montos y la confirmación de Por pagar." };
  const previa = await prepararEntregaTodoCorrecto(s.p_pedido_id, s.p_version_esperada);
  if (!previa.resumen) return { error: previa.error };
  if (JSON.stringify(previa.resumen.solicitud.p_items) !== JSON.stringify(s.p_items)) return { error: "La preparación cambió. Vuelve a revisar el pedido." };
  try {
    const db = await crearClienteSupabaseServidor();
    const { data, error } = await db.from("aplicaciones_pago")
      .select("monto_aplicado,pagos!inner(estado)").eq("pedido_id", s.p_pedido_id).eq("activa", true).eq("pagos.estado", "confirmado");
    if (error) return { error: "No fue posible consultar los abonos anteriores." };
    const pendiente = previa.resumen.total - (data ?? []).reduce((sum, a) => sum + Number(a.monto_aplicado), 0);
    if (!Number.isSafeInteger(pendiente) || pendiente < 0) return { error: "Los abonos anteriores requieren revisión contable." };
    const recibido = s.p_cobro.efectivo + s.p_cobro.transferencia;
    return { balance: { deuda_pendiente: Math.max(pendiente - recibido, 0), saldo_a_favor_generado: Math.max(recibido - pendiente, 0) } };
  } catch { return { error: "No fue posible revisar el cobro. Reintenta." }; }
}

export async function confirmarEntregaTodoCorrecto(s: SolicitudConCobro): Promise<{ resultado?: BalanceEntrega; error?: string }> {
  if (!s || !cobroValido(s.p_cobro) || !Number.isSafeInteger(s.p_version_esperada) || s.p_version_esperada < 0 ||
    !Array.isArray(s.p_items) || !s.p_items.length || s.p_items.some(i => !Number.isFinite(i.cantidad_entregada) || i.cantidad_entregada < 0)) {
    return { error: "Los datos de entrega o cobro no son válidos." };
  }
  let resultado: BalanceEntrega;
  try {
    const db = await crearClienteSupabaseServidor();
    const { data: sesion } = await db.auth.getUser();
    if (!sesion.user) return { error: "Tu sesión expiró. Inicia sesión y reintenta con la misma solicitud." };
    const { data, error } = await db.rpc("confirmar_entrega_todo_correcto", {
      p_pedido_id: s.p_pedido_id, p_version_esperada: s.p_version_esperada,
      p_clave: s.p_clave, p_items: s.p_items, p_cobro: s.p_cobro,
    });
    if (error) {
      const mensajes: Record<string, string> = {
        NO_AUTORIZADO: "No tienes permisos para confirmar entregas.",
        VERSION_OPERATIVA_CONFLICTO: "El pedido cambió. Cierra y revisa nuevamente antes de confirmar.",
        CLAVE_IDEMPOTENCIA_EN_USO: "Esta clave corresponde a otra solicitud. Revisa el pedido.",
        ESTADO_PEDIDO_INVALIDO: "El pedido ya no está disponible para entregar. Revisa su estado.",
        ENTREGA_NO_COINCIDE_CON_PREPARACION: "La entrega no coincide con la preparación confirmada.",
        METODO_E_IMPORTES_INCOMPATIBLES: "Revisa el método y los montos recibidos.",
        APLICACIONES_PREVIAS_SUPERAN_VENTA: "Los abonos anteriores superan la venta. Requiere revisión contable.",
      };
      return { error: mensajes[error.message] ?? "No se pudo confirmar la entrega y el cobro. Reintenta con la misma solicitud; la operación es atómica." };
    }
    resultado = data.resultado;
  } catch {
    return { error: "No se pudo verificar la respuesta. Reintenta: se conserva la misma clave para evitar duplicados." };
  }
  // Una falla de actualización visual no convierte una operación confirmada en fallida.
  try { revalidatePath("/admin/rutas"); } catch { /* El cliente también solicita los datos actualizados. */ }
  return { resultado };
}
