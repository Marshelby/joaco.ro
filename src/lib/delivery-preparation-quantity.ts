import { getClosedPresentationKind } from "@/lib/cart-quantity";
import type { ModoCantidadSnapshot } from "@/lib/order-preparation";

export function formatearCantidadPreparacionEntrega(
  cantidad: number,
  presentacion: string | null,
  unidad: string,
  modoCantidadSnapshot?: ModoCantidadSnapshot | null,
) {
  const texto = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 3 }).format(cantidad);
  const formatoCerrado = presentacion ? getClosedPresentationKind(presentacion) : null;
  const esFormatoCerrado = modoCantidadSnapshot === "presentacion_cerrada" || (!modoCantidadSnapshot && Boolean(formatoCerrado));
  if (esFormatoCerrado) {
    const etiquetaBase = formatoCerrado ?? "presentación";
    const etiqueta = cantidad === 1 ? etiquetaBase : `${etiquetaBase}s`;
    return `${texto} ${etiqueta}`;
  }
  const esKgFraccionable = modoCantidadSnapshot === "kg_fraccionable" || (!modoCantidadSnapshot && unidad.toUpperCase() === "KG");
  return esKgFraccionable ? `${texto} kg` : `${texto} ${cantidad === 1 ? "unidad" : "unidades"}`;
}
