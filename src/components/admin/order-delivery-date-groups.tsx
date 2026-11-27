import type { ReactNode } from "react";
import { CalendarDays } from "lucide-react";

import { esFechaCalendario, formatearFechaCalendario } from "@/lib/operational-date";

const fechaCompleta = { weekday: "long", day: "numeric", month: "long", year: "numeric" } as const;

export function OrderDeliveryDateGroups<T>({ pedidos, fechaEntrega, orden, children }: {
  pedidos: readonly T[];
  fechaEntrega: (pedido: T) => string | null | undefined;
  orden: "ascendente" | "descendente";
  children: (grupo: T[]) => ReactNode;
}) {
  const grupos = new Map<string, T[]>();
  const sinFecha: T[] = [];
  for (const pedido of pedidos) {
    const fecha = fechaEntrega(pedido);
    if (!esFechaCalendario(fecha)) {
      sinFecha.push(pedido);
      continue;
    }
    const grupo = grupos.get(fecha);
    if (grupo) grupo.push(pedido);
    else grupos.set(fecha, [pedido]);
  }
  const fechas = [...grupos.keys()].sort();
  if (orden === "descendente") fechas.reverse();

  const mostrarGrupo = (fecha: string | null, grupo: T[]) => (
    <section key={fecha ?? "sin-fecha"} className="space-y-1.5">
      <h3 className="flex items-center gap-2 rounded-md bg-secondary px-3 py-2 text-sm font-semibold text-secondary-foreground sm:text-base">
        <CalendarDays className="size-4 shrink-0 text-primary" aria-hidden="true" />
        <span className="min-w-0">
          {fecha ? <time dateTime={fecha} className="inline-block first-letter:uppercase">{formatearFechaCalendario(fecha, fechaCompleta)}</time> : "Sin fecha de entrega"}{" "}
          <span className="whitespace-nowrap tabular-nums">({grupo.length} {grupo.length === 1 ? "pedido" : "pedidos"})</span>
        </span>
        <span className="h-px min-w-3 flex-1 bg-linear-to-r from-primary to-accent" aria-hidden="true" />
      </h3>
      {children(grupo)}
    </section>
  );

  return <div className="space-y-4">
    {fechas.map(fecha => mostrarGrupo(fecha, grupos.get(fecha)!))}
    {sinFecha.length > 0 && mostrarGrupo(null, sinFecha)}
  </div>;
}
