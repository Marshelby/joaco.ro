import type { Metadata } from "next";

import { EmptyState } from "@/components/feedback/empty-state";
import { OrderStatusBadge } from "@/components/admin/order-status-badge";
import { PageHeader } from "@/components/shared/page-header";
import { ActionLink } from "@/components/ui/action-link";
import { ROUTES } from "@/config/routes";
import { formatFechaEntregaLarga } from "@/lib/delivery-date";
import { obtenerCantidadPedidosRecibidos, obtenerEntregasProximasAdmin, obtenerPedidosAdmin } from "@/lib/admin/pedidos";
import { formatCLP, formatDateTimeCL } from "@/lib/formatters";

export const metadata: Metadata = { title: "Pedidos" };

export default async function AdminOrdersPage({ searchParams }: { searchParams: Promise<{ filtro?: string }> }) {
  const { filtro } = await searchParams;
  const vista = filtro === "todos" || filtro === "entregas" ? filtro : "recibidos";
  const soloRecibidos = vista === "recibidos";
  const [pedidos, cantidadRecibidos, entregas] = await Promise.all([
    vista === "entregas" ? Promise.resolve([]) : obtenerPedidosAdmin(soloRecibidos),
    obtenerCantidadPedidosRecibidos(),
    vista === "entregas" ? obtenerEntregasProximasAdmin() : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader title="Pedidos" description="Revisa y confirma las solicitudes recibidas." />
      <section className="space-y-5" aria-labelledby="lista-pedidos-title">
        <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="lista-pedidos-title" className="text-2xl font-semibold tracking-tight text-foreground">{vista === "entregas" ? "Próximas entregas" : soloRecibidos ? `Pedidos recibidos (${cantidadRecibidos})` : "Todos los pedidos"}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{vista === "entregas" ? `${entregas.length} ${entregas.length === 1 ? "jornada" : "jornadas"} programadas` : `${pedidos.length} ${pedidos.length === 1 ? "pedido" : "pedidos"} visibles`}</p>
          </div>
          <nav aria-label="Filtro de pedidos" className="flex flex-wrap gap-2">
            <ActionLink href="/admin/pedidos" variant={soloRecibidos ? "primary" : "secondary"}>Recibidos</ActionLink>
            <ActionLink href="/admin/pedidos?filtro=entregas" variant={vista === "entregas" ? "primary" : "secondary"}>Próximas entregas</ActionLink>
            <ActionLink href="/admin/pedidos?filtro=todos" variant={vista === "todos" ? "primary" : "secondary"}>Todos</ActionLink>
          </nav>
        </div>
        {vista === "entregas" ? entregas.length > 0 ? (
          <ul className="grid gap-3 sm:grid-cols-2" aria-label="Próximas jornadas de entrega">
            {entregas.map((entrega) => (
              <li key={entrega.fecha} className="rounded-xl border border-border bg-card p-4 sm:p-5">
                <h3 className="font-semibold tracking-tight text-foreground">{formatFechaEntregaLarga(entrega.fecha)}</h3>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div><dt className="text-muted-foreground">Pedidos</dt><dd className="mt-1 font-semibold text-foreground">{entrega.cantidadPedidos}</dd></div>
                  <div><dt className="text-muted-foreground">Total estimado</dt><dd className="mt-1 font-semibold text-foreground">{formatCLP(entrega.total)}</dd></div>
                  {entrega.cantidadClientes > 0 ? <div><dt className="text-muted-foreground">Clientes</dt><dd className="mt-1 font-medium text-foreground">{entrega.cantidadClientes}</dd></div> : null}
                </dl>
                <ActionLink href={ROUTES.adminDeliveryDay(entrega.fecha)} variant="quiet" className="mt-4 -ml-3">Ver jornada</ActionLink>
              </li>
            ))}
          </ul>
        ) : <EmptyState title="No hay próximas entregas" description="Los pedidos con fecha de entrega programada aparecerán aquí." /> : pedidos.length > 0 ? (
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
