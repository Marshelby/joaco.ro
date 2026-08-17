import { CheckCircle2, ChevronDown } from "lucide-react";

import { OrderOperationalAction } from "@/components/admin/order-operational-action";
import { OrderStatusBadge } from "@/components/admin/order-status-badge";
import { ActionLink } from "@/components/ui/action-link";
import { ROUTES } from "@/config/routes";
import { formatearCantidadPreparacion, type PedidoEntregaAdmin } from "@/lib/admin/pedidos";
import { formatCLP, formatDateTimeCL } from "@/lib/formatters";

function mostrarPresentacion(pedido: PedidoEntregaAdmin["items"][number]) {
  if (!pedido.nombrePresentacion) return false;
  return pedido.nombrePresentacion.trim().toLocaleLowerCase("es-CL") !== pedido.nombreProducto.trim().toLocaleLowerCase("es-CL");
}

export function DeliveryOrderCard({ pedido }: { pedido: PedidoEntregaAdmin }) {
  const requierePreparacion = pedido.estado === "confirmado" || pedido.estado === "preparando";
  const pendienteDeConfirmacion = pedido.estado === "recibido";
  const listoParaDespacho = pedido.estado === "listo_despacho";

  return (
    <li className="rounded-xl border border-border bg-card p-4 sm:p-5">
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1.35fr)_minmax(8rem,0.8fr)_auto_auto] sm:items-center sm:gap-5">
        <div className="min-w-0">
          <h3 className="font-semibold tracking-tight text-foreground">{pedido.numeroPedido}</h3>
          <p className="mt-1 truncate text-sm text-muted-foreground">{pedido.destinatarioEntrega ?? pedido.nombreClienteSnapshot}</p>
          {pedido.zonaEntrega ? <p className="mt-1 text-sm text-muted-foreground">{pedido.zonaEntrega}</p> : null}
        </div>
        <dl className="grid grid-cols-2 gap-3 text-sm sm:block">
          <div><dt className="text-muted-foreground">Creado</dt><dd className="mt-1 font-medium text-foreground">{formatDateTimeCL(pedido.fechaCreacion)}</dd></div>
          <div className="sm:mt-2"><dt className="text-muted-foreground">Total</dt><dd className="mt-1 font-semibold text-foreground">{formatCLP(pedido.total)}</dd></div>
        </dl>
        <OrderStatusBadge estado={pedido.estado} />
        <ActionLink href={ROUTES.adminOrder(pedido.id)} variant="quiet" aria-label={`Ver detalle completo del pedido ${pedido.numeroPedido}`}>Ver detalle completo</ActionLink>
      </div>

      {requierePreparacion || pendienteDeConfirmacion || listoParaDespacho ? (
        <div className="mt-4 border-t border-border pt-3">
          {requierePreparacion ? <OrderOperationalAction pedidoId={pedido.id} estado={pedido.estado} contexto="preparacion" /> : null}
          {pendienteDeConfirmacion ? <p className="text-sm text-muted-foreground">Pendiente de confirmación</p> : null}
          {listoParaDespacho ? (
            <p className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary/10 px-3 text-sm font-semibold text-primary">
              <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
              Listo para despacho
            </p>
          ) : null}
        </div>
      ) : null}

      <details className="group mt-4 border-t border-border pt-3">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-2 text-sm font-semibold text-primary outline-none transition-colors hover:bg-muted hover:text-primary/75 focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
          <span className="group-open:hidden">Ver productos</span>
          <span className="hidden group-open:inline">Ocultar productos</span>
          <ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden="true" />
        </summary>
        <div className="mt-3 min-w-0 rounded-lg bg-muted/50 p-3">
          <h4 className="text-sm font-semibold text-foreground">Productos</h4>
          {pedido.items.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">No hay productos registrados en este pedido.</p> : (
            <ul className="mt-2 divide-y divide-border">
              {pedido.items.map((item) => (
                <li key={item.id} className="flex min-w-0 items-start justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <p className="break-words text-sm font-medium text-foreground">{item.nombreProducto}</p>
                    {mostrarPresentacion(item) ? <p className="mt-0.5 break-words text-xs text-muted-foreground">{item.nombrePresentacion}</p> : null}
                  </div>
                  <p className="shrink-0 text-sm font-semibold text-foreground">{formatearCantidadPreparacion(item)}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </details>
    </li>
  );
}
