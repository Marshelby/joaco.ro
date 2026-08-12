import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { OrderAcceptAction } from "@/components/admin/order-accept-action";
import { OrderStatusBadge } from "@/components/admin/order-status-badge";
import { PageHeader } from "@/components/shared/page-header";
import { ActionLink } from "@/components/ui/action-link";
import { ROUTES } from "@/config/routes";
import { formatearCantidadPedido, obtenerPedidoAdmin } from "@/lib/admin/pedidos";
import { formatCLP, formatDateTimeCL } from "@/lib/formatters";

export const metadata: Metadata = { title: "Detalle de pedido" };

export default async function AdminOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pedido = await obtenerPedidoAdmin(id);
  if (!pedido) notFound();

  const direccion = [pedido.direccionSnapshot, pedido.comunaSnapshot, pedido.regionSnapshot].filter(Boolean).join(", ");

  return (
    <div className="space-y-8">
      <PageHeader title={pedido.numeroPedido} description={`Creado el ${formatDateTimeCL(pedido.fechaCreacion)} · Canal ${pedido.canalOrigen}`} actions={<ActionLink href={ROUTES.adminOrders} variant="secondary">Volver a pedidos</ActionLink>} />
      <div className="flex flex-wrap items-center justify-between gap-4"><OrderStatusBadge estado={pedido.estado} />{pedido.estado === "recibido" ? <OrderAcceptAction pedidoId={pedido.id} /> : null}</div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-6">
          <section className="rounded-xl border border-border bg-card p-4 sm:p-5"><h2 className="text-lg font-semibold tracking-tight text-foreground">Productos</h2><ul className="mt-4 divide-y divide-border">{pedido.items.map((item) => <li key={item.id} className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_8rem_8rem] sm:items-center"><div className="min-w-0"><h3 className="font-medium text-foreground">{item.nombreProductoSnapshot}</h3><p className="mt-1 text-sm text-muted-foreground">{item.nombrePresentacionSnapshot ?? item.unidadSnapshot}</p></div><dl className="grid grid-cols-2 gap-3 text-sm sm:block"><div><dt className="text-muted-foreground">Cantidad</dt><dd className="mt-1 font-medium text-foreground">{formatearCantidadPedido(item.cantidad, item.unidadSnapshot)}</dd></div><div className="sm:mt-2"><dt className="text-muted-foreground">Valor unitario</dt><dd className="mt-1 font-medium text-foreground">{formatCLP(item.precioFinalUnitarioSnapshot)}</dd></div></dl><p className="text-right font-semibold text-foreground">{formatCLP(item.totalLinea)}</p></li>)}</ul></section>
          {pedido.observacionGeneral ? <section className="rounded-xl border border-border bg-card p-4 sm:p-5"><h2 className="text-lg font-semibold tracking-tight text-foreground">Observación</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{pedido.observacionGeneral}</p></section> : null}
        </div>
        <aside className="space-y-5"><section className="rounded-xl border border-border bg-card p-4 sm:p-5"><h2 className="text-lg font-semibold tracking-tight text-foreground">Cliente</h2><dl className="mt-4 space-y-3 text-sm"><div><dt className="text-muted-foreground">Nombre</dt><dd className="mt-1 font-medium text-foreground">{pedido.nombreClienteSnapshot}</dd></div>{pedido.telefonoClienteSnapshot ? <div><dt className="text-muted-foreground">Teléfono</dt><dd className="mt-1 text-foreground">{pedido.telefonoClienteSnapshot}</dd></div> : null}{pedido.emailClienteSnapshot ? <div><dt className="text-muted-foreground">Email</dt><dd className="mt-1 break-words text-foreground">{pedido.emailClienteSnapshot}</dd></div> : null}</dl></section>
          {direccion ? <section className="rounded-xl border border-border bg-card p-4 sm:p-5"><h2 className="text-lg font-semibold tracking-tight text-foreground">Entrega</h2><p className="mt-4 text-sm leading-6 text-foreground">{direccion}</p>{pedido.referenciaDireccionSnapshot ? <p className="mt-2 text-sm leading-6 text-muted-foreground">{pedido.referenciaDireccionSnapshot}</p> : null}</section> : null}
          <section className="rounded-xl border border-border bg-card p-4 sm:p-5"><h2 className="text-lg font-semibold tracking-tight text-foreground">Resumen</h2><dl className="mt-4 space-y-3 text-sm"><div className="flex justify-between gap-3"><dt className="text-muted-foreground">Subtotal</dt><dd>{formatCLP(pedido.subtotal)}</dd></div><div className="flex justify-between gap-3"><dt className="text-muted-foreground">Costo entrega</dt><dd>{formatCLP(pedido.costoEntrega)}</dd></div><div className="flex justify-between gap-3"><dt className="text-muted-foreground">Descuento</dt><dd>{formatCLP(pedido.descuento)}</dd></div><div className="flex justify-between gap-3 border-t border-border pt-3 text-base font-semibold text-foreground"><dt>Total</dt><dd>{formatCLP(pedido.total)}</dd></div></dl></section></aside>
      </div>
    </div>
  );
}
