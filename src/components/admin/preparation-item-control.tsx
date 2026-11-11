"use client";

import { PreparationCompactItemControl } from "./preparation-compact-item-control";
import type { ItemPreparacionPedidoAdmin } from "@/lib/admin/pedidos";

// Todas las vistas guardan cantidades; sólo el resumen de ruta las confirma.
export function PreparationItemControl({ item, version, soloLectura = false, cantidadEnviada = 0 }: { item: ItemPreparacionPedidoAdmin; version: number; soloLectura?: boolean; cantidadEnviada?: number }) {
  return <PreparationCompactItemControl item={item} version={version} soloLectura={soloLectura} cantidadEnviada={cantidadEnviada} />;
}
