import { CustomerHistorySection } from "@/components/admin/customer-history-section";
import { CustomerOrderLink } from "@/components/admin/order-customer-navigation";
import { OrderStatusBadge } from "@/components/admin/order-status-badge";
import { EmptyState } from "@/components/feedback/empty-state";
import { ROUTES } from "@/config/routes";
import type { PedidoClienteAdmin } from "@/lib/admin/clientes";
import { formatCLP } from "@/lib/formatters";
import { formatearInstanteSantiago } from "@/lib/operational-date";

export function CustomerOrderHistory({ pedidos, readOnly }: {
  pedidos: readonly PedidoClienteAdmin[];
  readOnly: boolean;
}) {
  const meses = new Map<string, PedidoClienteAdmin[]>();
  // La ficha entrega los pedidos ordenados por fecha de creación descendente.
  for (const pedido of pedidos) {
    const mes = formatearInstanteSantiago(pedido.fechaCreacion, { month: "long", year: "numeric" });
    const grupo = meses.get(mes);
    if (grupo) grupo.push(pedido);
    else meses.set(mes, [pedido]);
  }

  return (
    <CustomerHistorySection section="pedidos" count={pedidos.length} compact>
      {meses.size === 0 && <EmptyState title="Este cliente todavía no tiene pedidos" description="Los pedidos futuros aparecerán aquí." />}
      {Array.from(meses, ([mes, grupo]) => (
        <section key={mes} className="space-y-2">
          <h3 className="flex items-center gap-3 text-sm font-semibold text-muted-foreground after:h-px after:flex-1 after:bg-border">
            <span className="first-letter:uppercase">{mes}</span>
          </h3>
          <ul className="space-y-1.5">
            {grupo.map((pedido) => (
              <li key={pedido.id} className="flex flex-wrap items-start gap-x-3 gap-y-2 rounded-xl border border-border bg-background p-2 wrap-anywhere @3xl:items-center">
                <time dateTime={pedido.fechaCreacion} className="flex w-20 shrink-0 flex-col rounded-lg bg-primary/8 px-1.5 py-1 text-center text-xs text-primary">
                  <span className="text-xl leading-none font-semibold tabular-nums">{formatearInstanteSantiago(pedido.fechaCreacion, { day: "2-digit" })}</span>
                  <span className="first-letter:uppercase">{formatearInstanteSantiago(pedido.fechaCreacion, { weekday: "long" })}</span>
                  <span className="tabular-nums text-muted-foreground">{formatearInstanteSantiago(pedido.fechaCreacion, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" })}</span>
                </time>
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1.5">
                  <h4 className="min-w-0 basis-full text-sm font-semibold @3xl:flex-1 @3xl:basis-auto">{pedido.numeroPedido}</h4>
                  <OrderStatusBadge estado={pedido.estado} />
                  <p className="text-sm font-semibold tabular-nums">{formatCLP(pedido.total)}</p>
                  <p className="text-xs font-medium text-muted-foreground">{pedido.saldoPendiente > 0 ? `Pendiente: ${formatCLP(pedido.saldoPendiente)}` : "Pagado"}</p>
                  {!readOnly && (
                    <CustomerOrderLink href={ROUTES.adminOrder(pedido.id)} scroll={false} prefetch={false} variant="quiet" aria-label={`Ver pedido ${pedido.numeroPedido}`}>
                      Ver pedido
                    </CustomerOrderLink>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </CustomerHistorySection>
  );
}
