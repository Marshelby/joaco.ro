import { OrderDeliveryDateGroups } from "@/components/admin/order-delivery-date-groups";
import { OrderDeliveryImage } from "@/components/admin/order-delivery-image";
import { fechaEntregaDefinitiva } from "@/lib/admin/guia-entrega";
import { DeliveryResult, DeliveryResultDetails, esResultadoEntrega, importeResultado, presentarResultadoEntrega } from "@/components/admin/delivery-result";
import { obtenerResultadosEntrega } from "@/lib/admin/resultado-entrega";
import { RecycleOrderLink } from "@/components/admin/recycle-order-link";
import { CreateOrderLink } from "@/components/admin/create-order-link";
import { UndeliveredOrders } from "@/components/admin/undelivered-orders";
import { accionesPedido, filaPedido, OrderListData, OrderListIdentity, tarjetaPedido } from "@/components/admin/order-list-row";
import { OrderViews } from "@/components/admin/order-views";
import { PossibleOrdersList } from "@/components/admin/possible-orders-list";
import type { Metadata } from "next";
import { Camera } from "lucide-react";

import { EmptyState } from "@/components/feedback/empty-state";
import { OrderStatusBadge } from "@/components/admin/order-status-badge";
import { PageHeader } from "@/components/shared/page-header";
import { ActionLink } from "@/components/ui/action-link";
import { ROUTES } from "@/config/routes";
import { obtenerPedidosAdmin } from "@/lib/admin/pedidos";
import { formatCLP } from "@/lib/formatters";

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
  const botonCabecera = "min-h-9 px-3 text-xs motion-safe:duration-200";
  const vista = filtro === "no-entregados" || filtro === "posibles" || filtro === "entregados" || filtro === "todos" ? filtro : "recibidos";
  const cabecera = <PageHeader title="Pedidos"
    description={vista === "no-entregados" ? "Seguimiento administrativo de entregas fallidas." : "Revisa y confirma las solicitudes recibidas."}
    className="gap-2 pb-3 sm:items-center [&>div:first-child]:space-y-1 [&_h1]:text-2xl [&_p]:text-sm"
    actions={<div className="flex flex-wrap gap-1.5">
      {vista !== "no-entregados" && <CreateOrderLink className={botonCabecera} />}
      <ActionLink href={constanciasHref} prefetch={false} variant="secondary" className={`${botonCabecera} gap-1.5`}>
        <Camera className="size-3.5 shrink-0" aria-hidden="true" />
        Constancias
      </ActionLink>
    </div>}
  />;
  const navegacion = <OrderViews vista={vista} />;
  if (vista === "no-entregados") return <div className="@container space-y-3">
    {cabecera}
    {navegacion}
    <UndeliveredOrders filtros={params} />
  </div>;
  if (vista === "posibles") return <div className="@container space-y-3">
    {cabecera}
    {navegacion}
    <PossibleOrdersList params={params} baseHref="/admin/pedidos?filtro=posibles" embedded agruparPorEntrega />
  </div>;

  const soloRecibidos = vista === "recibidos";
  const todosPedidos = await obtenerPedidosAdmin(soloRecibidos);
  const pedidos = vista === "entregados" ? todosPedidos.filter(p => p.estado === "entregado") : todosPedidos;
  const resultados = await obtenerResultadosEntrega(pedidos.filter(p => p.estado === "entregado").map(p => p.id));

  return (
    <div className="@container space-y-3">
      {cabecera}
      {navegacion}
      <section className="space-y-2" aria-labelledby="lista-pedidos-title">
        <h2 id="lista-pedidos-title" className="sr-only">{soloRecibidos ? "Pedidos recibidos" : vista === "entregados" ? "Entregados" : "Todos los pedidos"}</h2>
        {pedidos.length > 0 ? (
          <OrderDeliveryDateGroups pedidos={pedidos} fechaEntrega={pedido => pedido.fechaEntrega} orden={soloRecibidos ? "ascendente" : "descendente"}>
            {grupo => <ul className="space-y-1.5" aria-label="Pedidos">
              {grupo.map((pedido) => {
                const verPedido = <ActionLink href={ROUTES.adminOrder(pedido.id)} scroll={false} prefetch={false} variant="quiet" aria-label={`Ver pedido ${pedido.numeroPedido}`}>Ver pedido</ActionLink>;
                if (esResultadoEntrega(pedido.estado)) {
                  const datos = presentarResultadoEntrega(pedido.estado, pedido.total, resultados[pedido.id]);
                  return <li key={pedido.id}>
                    <DeliveryResult tipo={datos.tipo} cliente={pedido.nombreClienteSnapshot} numero={pedido.numeroPedido} importe={importeResultado(datos)}
                      compact={{
                        solicitud: pedido.fechaCreacion,
                        ubicacion: pedido.nombreUbicacionSnapshot,
                        acciones: <>
                          <RecycleOrderLink pedidoId={pedido.id} />
                          {verPedido}
                          {fechaEntregaDefinitiva(pedido) && <OrderDeliveryImage pedidoId={pedido.id} />}
                        </>,
                      }}>
                      <DeliveryResultDetails datos={datos}>
                        {datos.resultado?.total_cobrado != null && <p>Total cobrado en la entrega · <strong>{formatCLP(datos.resultado.total_cobrado)}</strong></p>}
                      </DeliveryResultDetails>
                    </DeliveryResult>
                  </li>;
                }
                return <li key={pedido.id} className={`${tarjetaPedido} ${filaPedido}`}>
                  <OrderListIdentity cliente={pedido.nombreClienteSnapshot} referencia={`Pedido ${pedido.numeroPedido}`} ubicacion={pedido.nombreUbicacionSnapshot} />
                  <div><OrderStatusBadge estado={pedido.estado} /></div>
                  <OrderListData solicitud={pedido.fechaCreacion} ocultarEntrega importe={formatCLP(pedido.total)} etiquetaImporte="Total original" />
                  <div className={accionesPedido}>{verPedido}</div>
                </li>;
              })}
            </ul>}
          </OrderDeliveryDateGroups>
        ) : <EmptyState title={soloRecibidos ? "No hay pedidos recibidos" : "No hay pedidos"} description={soloRecibidos ? "Los nuevos pedidos aparecerán aquí para su revisión." : "Cuando existan pedidos, podrás revisarlos aquí."} />}
      </section>
    </div>
  );
}
