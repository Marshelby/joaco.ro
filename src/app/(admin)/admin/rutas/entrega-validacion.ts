import type { SolicitudConCobro, SolicitudEntregaTodoCorrecto } from "./entrega-actions";

const uuid = (v: unknown) => typeof v === "string" && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(v);
export function solicitudValida(s: SolicitudEntregaTodoCorrecto) {
  return s && uuid(s.p_pedido_id) && uuid(s.p_clave) && Number.isSafeInteger(s.p_version_esperada) && s.p_version_esperada >= 0 && s.p_version_esperada < Number.MAX_SAFE_INTEGER &&
    Array.isArray(s.p_items) && s.p_items.length > 0 && new Set(s.p_items.map(i => i?.item_pedido_id)).size === s.p_items.length &&
    s.p_items.every(i => i && uuid(i.item_pedido_id) && typeof i.cantidad_entregada === "number" && Number.isFinite(i.cantidad_entregada) && i.cantidad_entregada >= 0 && i.cantidad_entregada < 1e9 && /^\d+(\.\d{1,3})?$/.test(String(i.cantidad_entregada)));
}
export function cobroValido(s: SolicitudConCobro) {
  const c = s?.p_cobro;
  return c && [c.efectivo, c.transferencia, c.efectivo + c.transferencia].every(n => Number.isSafeInteger(n) && n >= 0) &&
    ((c.metodo === "por_pagar" && c.confirmar_por_pagar === true && c.efectivo === 0 && c.transferencia === 0) ||
    (c.confirmar_por_pagar === false && ((c.metodo === "efectivo" && c.efectivo > 0 && c.transferencia === 0) ||
    (c.metodo === "transferencia" && c.transferencia > 0 && c.efectivo === 0) || (c.metodo === "ambos" && c.efectivo > 0 && c.transferencia > 0))));
}

// La RPC devuelve historial y referencias internas: exponer solo el balance validado.
export function leerBalanceEntrega(valor: unknown) {
  if (!valor || typeof valor !== "object" || !("deuda_pendiente" in valor) || !("saldo_a_favor_generado" in valor)) return null;
  const deuda = valor.deuda_pendiente;
  const saldo = valor.saldo_a_favor_generado;
  if (typeof deuda !== "number" || typeof saldo !== "number" ||
    !Number.isSafeInteger(deuda) || deuda < 0 || !Number.isSafeInteger(saldo) || saldo < 0) return null;
  return { deuda_pendiente: deuda, saldo_a_favor_generado: saldo };
}
