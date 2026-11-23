import { OrderDeliveryImage } from "@/components/admin/order-delivery-image";
import { fechaEntregaDefinitiva } from "@/lib/admin/guia-entrega";
import { DeliveryResult, DeliveryResultDetails, esResultadoEntrega, importeResultado, presentarResultadoEntrega } from "@/components/admin/delivery-result";
import { obtenerResultadosEntrega } from "@/lib/admin/resultado-entrega";
import { RecycleOrderLink } from "@/components/admin/recycle-order-link";
import { CreateOrderLink } from "@/components/admin/create-order-link";
import { UndeliveredOrders } from "@/components/admin/undelivered-orders";
import { OrderIdentity } from "@/components/admin/order-identity";
import { OrderViews } from "@/components/admin/order-views";
import { PossibleOrdersList } from "@/components/admin/possible-orders-list";
import type { Metadata } from "next";
import { Camera } from "lucide-react";

import { EmptyState } from "@/components/feedback/empty-state";
import { OrderStatusBadge } from "@/components/admin/order-status-badge";
import { PageHeader } from "@/components/shared/page-header";
import { ActionLink } from "@/components/ui/action-link";
import { ROUTES } from "@/config/routes";
import { formatFechaEntregaLarga } from "@/lib/delivery-date";
import { obtenerCantidadPedidosRecibidos, obtenerPedidosAdmin } from "@/lib/admin/pedidos";
import { formatCLP, formatDateTimeCL } from "@/lib/formatters";

export const metadata: Metadata = { title: "Pedidos" };

export default async function AdminOrdersPage({ searchParams }: { searchParams: Promise<{ filtro?: string; estado?: string; pagina?: string; q?: string; desde?: string; hasta?: string }> }) {
  const params = await searchParams;
  const { filtro } = params;
  const consulta = new URLSearchParams();
  for (const [clave, valor] of Object.entries(params)) {
    for (const item of Array.isArray(valor) ? valor : [valor]) {
      if (typeof item === "string") consulta.append(clave, item);
    }
  }
  const constanciasHref = consulta.size
    ? `${ROUTES.adminConstancias}?${new URLSearchParams({ volver: consulta.toString() })}`
    : ROUTES.adminConstancias;
  const constancias = (
    <ActionLink href={constanciasHref} prefetch={false} className="gap-2">
      <Camera className="size-4 shrink-0" aria-hidden="true" />
      Constancias
    </ActionLink>
  );
  const actions = <div className="flex flex-wrap gap-2"><CreateOrderLink />{constancias}</div>;
  if (filtro === "no-entregados") return <div className="space-y-8">
    <PageHeader title="Pedidos" description="Seguimiento administrativo de entregas fallidas." actions={constancias} />
    <OrderViews vista="no-entregados" />
    <UndeliveredOrders filtros={params} />
  </div>;
  if (filtro === "posibles") return <div className="space-y-8">
    <PageHeader title="Pedidos" description="Revisa y confirma las solicitudes recibidas." actions={actions} />
    <OrderViews vista="posibles" />
    <PossibleOrdersList params={params} baseHref="/admin/pedidos?filtro=posibles" embedded />
  </div>;
  const vista = filtro === "entregados" ? "entregados" : filtro === "todos" ? "todos" : "recibidos";
  const soloRecibidos = vista === "recibidos";
  const [todosPedidos, cantidadRecibidos] = await Promise.all([
    obtenerPedidosAdmin(soloRecibidos),
    soloRecibidos ? obtenerCantidadPedidosRecibidos() : Promise.resolve(0),
  ]);

  const pedidos = vista === "entregados" ? todosPedidos.filter(p => p.estado === "entregado") : todosPedidos;

  const resultados = await obtenerResultadosEntrega(pedidos.filter(p => p.estado === "entregado").map(p => p.id));

  return (
    <div className="space-y-8">
      <PageHeader title="Pedidos" description="Revisa y confirma las solicitudes recibidas." actions={actions} />
      <section className="space-y-5" aria-labelledby="lista-pedidos-title">
        <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="lista-pedidos-title" className="text-2xl font-semibold tracking-tight text-foreground">{soloRecibidos ? `Pedidos recibidos (${cantidadRecibidos})` : vista === "entregados" ? "Entregados" : "Todos los pedidos"}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{`${pedidos.length} ${pedidos.length === 1 ? "pedido" : "pedidos"} visibles`}</p>
          </div>
          <OrderViews vista={vista} />
        </div>
        {pedidos.length > 0 ? (
          <ul className="space-y-3" aria-label="Pedidos">
            {pedidos.map((pedido) => {
              if (esResultadoEntrega(pedido.estado)) {
                const datos = presentarResultadoEntrega(pedido.estado, pedido.total, resultados[pedido.id]);
                return <li key={pedido.id} className="min-w-0">
                  <DeliveryResult tipo={datos.tipo} cliente={pedido.nombreClienteSnapshot} numero={pedido.numeroPedido} importe={importeResultado(datos)}>
                    <p className="text-xs text-muted-foreground">Creado el {formatDateTimeCL(pedido.fechaCreacion)}{pedido.fechaEntrega && ` · Entrega programada ${formatFechaEntregaLarga(pedido.fechaEntrega)}`}</p>
                    {pedido.nombreUbicacionSnapshot && <p className="text-xs text-muted-foreground">{pedido.nombreUbicacionSnapshot}</p>}
                    <DeliveryResultDetails datos={datos}>
                      {datos.resultado?.total_cobrado != null && <p>Total cobrado en la entrega · <strong>{formatCLP(datos.resultado.total_cobrado)}</strong></p>}
                    </DeliveryResultDetails>
                    <div className="flex flex-wrap gap-2">
                      <RecycleOrderLink pedidoId={pedido.id} />
                      <ActionLink href={ROUTES.adminOrder(pedido.id)} scroll={false} prefetch={false} variant="quiet" aria-label={`Ver pedido ${pedido.numeroPedido}`}>Ver pedido</ActionLink>
                      {fechaEntregaDefinitiva(pedido) && <OrderDeliveryImage pedidoId={pedido.id} />}
                    </div>
                  </DeliveryResult>
                </li>;
              }
              return (
                <li key={pedido.id} className="rounded-xl border border-border bg-card p-4 sm:p-5">
                  <div className="grid gap-4 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] xl:grid-cols-[minmax(0,1.5fr)_minmax(12rem,1fr)_auto] md:items-center md:gap-6">
                    <div className="min-w-0">
                      <OrderIdentity pedido={pedido} />
                      <div className="mt-3"><OrderStatusBadge estado={pedido.estado} destacado /></div>
                    </div>
                    <dl className="grid grid-cols-2 gap-3 text-sm sm:block"><div><dt className="text-muted-foreground">Fecha</dt><dd className="mt-1 font-medium text-foreground">{formatDateTimeCL(pedido.fechaCreacion)}</dd></div><div className="sm:mt-2"><dt className="text-muted-foreground">Entrega</dt><dd className="mt-1 font-medium text-foreground">{pedido.fechaEntrega ? formatFechaEntregaLarga(pedido.fechaEntrega) : "Sin fecha registrada"}</dd></div><div className="sm:mt-2"><dt className="text-muted-foreground">Total original</dt><dd className="mt-1 font-semibold text-foreground">{formatCLP(pedido.total)}</dd></div></dl>
                    <div className="flex flex-wrap gap-2"><ActionLink href={ROUTES.adminOrder(pedido.id)} scroll={false} prefetch={false} variant="quiet" aria-label={`Ver pedido ${pedido.numeroPedido}`}>Ver pedido</ActionLink></div>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : <EmptyState title={soloRecibidos ? "No hay pedidos recibidos" : "No hay pedidos"} description={soloRecibidos ? "Los nuevos pedidos aparecerán aquí para su revisión." : "Cuando existan pedidos, podrás revisarlos aquí."} />}
      </section>
    </div>
  );
}
