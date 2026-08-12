import type { Metadata } from "next";

import { EmptyState } from "@/components/feedback/empty-state";
import { OrderStatusBadge } from "@/components/admin/order-status-badge";
import { PageHeader } from "@/components/shared/page-header";
import { ActionLink } from "@/components/ui/action-link";
import { ROUTES } from "@/config/routes";
import { obtenerCantidadPedidosRecibidos, obtenerPedidosAdmin } from "@/lib/admin/pedidos";
import { formatCLP, formatDateTimeCL } from "@/lib/formatters";

export const metadata: Metadata = { title: "Pedidos" };

export default async function AdminOrdersPage({ searchParams }: { searchParams: Promise<{ filtro?: string }> }) {
  const { filtro } = await searchParams;
  const soloRecibidos = filtro !== "todos";
  const [pedidos, cantidadRecibidos] = await Promise.all([obtenerPedidosAdmin(soloRecibidos), obtenerCantidadPedidosRecibidos()]);

  return (
    <div className="space-y-8">
      <PageHeader title="Pedidos" description="Revisa y confirma las solicitudes recibidas." />
      <section className="space-y-5" aria-labelledby="lista-pedidos-title">
        <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="lista-pedidos-title" className="text-2xl font-semibold tracking-tight text-foreground">{soloRecibidos ? `Pedidos recibidos (${cantidadRecibidos})` : "Todos los pedidos"}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{pedidos.length} {pedidos.length === 1 ? "pedido" : "pedidos"} visibles</p>
          </div>
          <nav aria-label="Filtro de pedidos" className="flex gap-2">
            <ActionLink href="/admin/pedidos" variant={soloRecibidos ? "primary" : "secondary"}>Recibidos</ActionLink>
            <ActionLink href="/admin/pedidos?filtro=todos" variant={!soloRecibidos ? "primary" : "secondary"}>Todos</ActionLink>
          </nav>
        </div>
        {pedidos.length > 0 ? (
          <ul className="space-y-3" aria-label="Pedidos">
            {pedidos.map((pedido) => (
              <li key={pedido.id} className="rounded-xl border border-border bg-card p-4 sm:p-5">
                <div className="grid gap-4 sm:grid-cols-[minmax(0,1.35fr)_minmax(8rem,0.8fr)_minmax(8rem,0.8fr)_auto] sm:items-center sm:gap-5">
                  <div className="min-w-0"><h3 className="font-semibold tracking-tight text-foreground">{pedido.numeroPedido}</h3><p className="mt-1 truncate text-sm text-muted-foreground">{pedido.nombreClienteSnapshot}</p></div>
                  <dl className="grid grid-cols-2 gap-3 text-sm sm:block"><div><dt className="text-muted-foreground">Fecha</dt><dd className="mt-1 font-medium text-foreground">{formatDateTimeCL(pedido.fechaCreacion)}</dd></div><div className="sm:mt-2"><dt className="text-muted-foreground">Total</dt><dd className="mt-1 font-semibold text-foreground">{formatCLP(pedido.total)}</dd></div></dl>
                  <div><span className="text-sm text-muted-foreground sm:sr-only">Estado</span><div className="mt-1 sm:mt-0"><OrderStatusBadge estado={pedido.estado} /></div></div>
                  <ActionLink href={ROUTES.adminOrder(pedido.id)} variant="quiet" aria-label={`Ver pedido ${pedido.numeroPedido}`}>Ver pedido</ActionLink>
                </div>
              </li>
            ))}
          </ul>
        ) : <EmptyState title={soloRecibidos ? "No hay pedidos recibidos" : "No hay pedidos"} description={soloRecibidos ? "Los nuevos pedidos aparecerán aquí para su revisión." : "Cuando existan pedidos, podrás revisarlos aquí."} />}
      </section>
    </div>
  );
}
