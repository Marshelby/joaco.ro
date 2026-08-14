import { Circle } from "lucide-react";

import { getEtiquetaEstadoPedidoCuenta } from "@/components/account/customer-order-status-badge";
import { formatDateTimeCL } from "@/lib/formatters";
import type { HistorialEstadoPedidoCuenta } from "@/lib/account/pedidos";

export function OrderTrackingTimeline({ historial }: { historial: readonly HistorialEstadoPedidoCuenta[] }) {
  return (
    <ol className="space-y-4" aria-label="Historial de estados del pedido">
      {historial.map((item) => <li key={item.id} className="flex items-start gap-3">
        <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border border-primary bg-primary text-primary-foreground"><Circle className="size-3.5" aria-hidden="true" /></span>
        <div>
          <p className="text-sm font-medium text-foreground">{getEtiquetaEstadoPedidoCuenta(item.estadoNuevo)}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{formatDateTimeCL(item.fechaCreacion)}</p>
          {item.observacion ? <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.observacion}</p> : null}
        </div>
      </li>)}
    </ol>
  );
}
