import type { ReactNode } from "react";

import { formatearFechaCalendario, formatearInstanteSantiago } from "@/lib/operational-date";

const fechaCorta = { day: "2-digit", month: "2-digit", year: "numeric" } as const;

export const tarjetaPedido = "min-w-0 rounded-lg border border-border bg-card";
export const accionesPedido = "flex flex-wrap items-center gap-1.5 col-span-2 @min-[42rem]:col-span-3 @min-[62rem]:col-span-1 @min-[62rem]:max-w-72 [&>a]:min-h-9 [&>a]:px-2.5 [&>a]:text-xs [&>button]:min-h-9 [&>button]:text-xs";
export const filaPedido = "grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 px-3 py-2 @min-[42rem]:grid-cols-[minmax(0,1.15fr)_minmax(0,0.7fr)_minmax(0,1.65fr)] @min-[62rem]:grid-cols-[minmax(0,1.15fr)_minmax(0,0.7fr)_minmax(0,1.65fr)_auto]";

export function OrderListData({ solicitud, entrega, etiquetaEntrega = "Entrega", importe, etiquetaImporte }: {
  solicitud?: string | null;
  entrega?: string | null;
  etiquetaEntrega?: string;
  importe: string;
  etiquetaImporte: string;
}) {
  return <span className="grid min-w-0 grid-cols-[repeat(3,minmax(0,1fr))] gap-x-2 text-xs wrap-anywhere col-span-2 @min-[42rem]:col-span-1">
    <OrderListField label="Solicitud">{solicitud ? formatearInstanteSantiago(solicitud, { ...fechaCorta, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }) : "Sin registro"}</OrderListField>
    <OrderListField label={etiquetaEntrega}>{entrega ? formatearFechaCalendario(entrega, fechaCorta) : "Sin fecha"}</OrderListField>
    <OrderListField label={etiquetaImporte}>{importe}</OrderListField>
  </span>;
}

function OrderListField({ label, children }: { label: string; children: ReactNode }) {
  return <span>
    <span className="block text-muted-foreground">{label}</span>
    <span className="block font-semibold tabular-nums">{children}</span>
  </span>;
}

export function OrderListIdentity({ cliente, referencia, ubicacion }: {
  cliente: string;
  referencia?: string;
  ubicacion?: string | null;
}) {
  return <span className="block min-w-0 text-sm wrap-anywhere">
    <span className="block font-semibold text-foreground">{cliente}</span>
    {referencia && <span className="block text-xs font-medium text-muted-foreground">{referencia}</span>}
    {ubicacion?.trim() && <span className="block text-xs text-muted-foreground">{ubicacion}</span>}
  </span>;
}
