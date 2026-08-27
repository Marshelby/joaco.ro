/**
 * Cotización visual para carrito y checkout. La RPC crear_pedido_desde_carrito
 * vuelve a calcular precios y despacho, por lo que es la autoridad final.
 */
export const UMBRAL_DESPACHO_GRATIS = 25_000;
export const COSTO_DESPACHO_BASE = 2_000;

export function cotizarDespacho(subtotal: number) {
  const costoEntrega = subtotal < UMBRAL_DESPACHO_GRATIS ? COSTO_DESPACHO_BASE : 0;

  return {
    subtotal,
    costoEntrega,
    faltanteParaGratis: Math.max(UMBRAL_DESPACHO_GRATIS - subtotal, 0),
    totalEstimado: subtotal + costoEntrega,
    tieneDespachoGratis: subtotal >= UMBRAL_DESPACHO_GRATIS,
  };
}
