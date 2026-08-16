import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { OrderStatusBadge } from "@/components/admin/order-status-badge";
import { EmptyState } from "@/components/feedback/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { ActionLink } from "@/components/ui/action-link";
import { ROUTES } from "@/config/routes";
import { formatFechaEntregaLarga } from "@/lib/delivery-date";
import { formatearCantidadConUnidadEntrega, obtenerDetalleEntregaAdmin } from "@/lib/admin/pedidos";
import { formatCLP, formatDateTimeCL } from "@/lib/formatters";

export const metadata: Metadata = { title: "Jornada de entrega" };

function esFechaReal(fecha: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return false;
  const [ano, mes, dia] = fecha.split("-").map(Number);
  const date = new Date(Date.UTC(ano, mes - 1, dia));
  return date.getUTCFullYear() === ano && date.getUTCMonth() === mes - 1 && date.getUTCDate() === dia;
}

export default async function AdminDeliveryDayPage({ params }: { params: Promise<{ fecha: string }> }) {
  const { fecha } = await params;
  if (!esFechaReal(fecha)) notFound();

  const entrega = await obtenerDetalleEntregaAdmin(fecha);
  const tituloFecha = formatFechaEntregaLarga(fecha).toLocaleLowerCase("es-CL");

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Entregas del ${tituloFecha}`}
        description="Jornada derivada de los pedidos programados para esta fecha."
        actions={<ActionLink href="/admin/pedidos?filtro=entregas" variant="secondary">Volver a próximas entregas</ActionLink>}
      />

      {entrega.pedidos.length === 0 ? (
        <EmptyState title="No hay pedidos para esta fecha" description="Cuando se programen pedidos para esta jornada, aparecerán aquí." />
      ) : (
        <>
          <section className="grid gap-3 sm:grid-cols-3" aria-label="Resumen de jornada">
            <div className="rounded-xl border border-border bg-card p-4"><p className="text-sm text-muted-foreground">Pedidos</p><p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">{entrega.pedidos.length}</p></div>
            <div className="rounded-xl border border-border bg-card p-4"><p className="text-sm text-muted-foreground">Total estimado</p><p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">{formatCLP(entrega.total)}</p></div>
            <div className="rounded-xl border border-border bg-card p-4"><p className="text-sm text-muted-foreground">Clientes</p><p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">{entrega.cantidadClientes}</p></div>
          </section>

          <section className="rounded-xl border border-border bg-card p-4 sm:p-5" aria-labelledby="productos-necesarios-title">
            <div><h2 id="productos-necesarios-title" className="text-lg font-semibold tracking-tight text-foreground">Productos necesarios</h2><p className="mt-1 text-sm text-muted-foreground">Consolidado de las presentaciones solicitadas para preparar esta jornada.</p></div>
            <ul className="mt-4 divide-y divide-border">
              {entrega.resumenProductos.map((item) => (
                <li key={item.clave} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0"><h3 className="font-medium text-foreground">{item.producto}</h3><p className="mt-1 text-sm text-muted-foreground">{item.presentacion ?? item.unidad}</p></div>
                  <p className="shrink-0 font-semibold text-foreground">{formatearCantidadConUnidadEntrega(item.cantidadTotal, item.unidad)}</p>
                </li>
              ))}
            </ul>
          </section>

          <section className="space-y-4" aria-labelledby="pedidos-jornada-title">
            <div><h2 id="pedidos-jornada-title" className="text-xl font-semibold tracking-tight text-foreground">Pedidos</h2><p className="mt-1 text-sm text-muted-foreground">Ordenados por creación; todavía no representa una ruta logística.</p></div>
            <ul className="space-y-3" aria-label="Pedidos de la jornada">
              {entrega.pedidos.map((pedido) => (
                <li key={pedido.id} className="rounded-xl border border-border bg-card p-4 sm:p-5">
                  <div className="grid gap-4 sm:grid-cols-[minmax(0,1.35fr)_minmax(8rem,0.8fr)_auto_auto] sm:items-center sm:gap-5">
                    <div className="min-w-0"><h3 className="font-semibold tracking-tight text-foreground">{pedido.numeroPedido}</h3><p className="mt-1 truncate text-sm text-muted-foreground">{pedido.destinatarioEntrega ?? pedido.nombreClienteSnapshot}</p>{pedido.zonaEntrega ? <p className="mt-1 text-sm text-muted-foreground">{pedido.zonaEntrega}</p> : null}</div>
                    <dl className="grid grid-cols-2 gap-3 text-sm sm:block"><div><dt className="text-muted-foreground">Creado</dt><dd className="mt-1 font-medium text-foreground">{formatDateTimeCL(pedido.fechaCreacion)}</dd></div><div className="sm:mt-2"><dt className="text-muted-foreground">Total</dt><dd className="mt-1 font-semibold text-foreground">{formatCLP(pedido.total)}</dd></div></dl>
                    <OrderStatusBadge estado={pedido.estado} />
                    <ActionLink href={ROUTES.adminOrder(pedido.id)} variant="quiet" aria-label={`Ver pedido ${pedido.numeroPedido}`}>Ver pedido</ActionLink>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
