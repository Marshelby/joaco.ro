export const PAYMENT_INTENT_OPTIONS = ["efectivo", "transferencia", "tarjeta"] as const;

export type MetodoPagoPrevisto = (typeof PAYMENT_INTENT_OPTIONS)[number];

export const PAYMENT_INTENT_LABELS: Record<MetodoPagoPrevisto, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  tarjeta: "Tarjeta",
};

export function esMetodoPagoPrevisto(value: unknown): value is MetodoPagoPrevisto {
  return typeof value === "string" && (PAYMENT_INTENT_OPTIONS as readonly string[]).includes(value);
}

export function normalizarMetodosPagoPrevistos(values: readonly unknown[]): MetodoPagoPrevisto[] | null {
  if (values.length === 0 || values.length > PAYMENT_INTENT_OPTIONS.length) return null;
  if (!values.every(esMetodoPagoPrevisto)) return null;

  const seleccionados = new Set(values);
  if (seleccionados.size !== values.length) return null;

  return PAYMENT_INTENT_OPTIONS.filter((metodo) => seleccionados.has(metodo));
}

export function formatearMetodosPagoPrevistos(values: readonly unknown[] | null | undefined): string | null {
  if (!values) return null;

  const metodos = normalizarMetodosPagoPrevistos(values);
  return metodos ? metodos.map((metodo) => PAYMENT_INTENT_LABELS[metodo]).join(" · ") : null;
}
