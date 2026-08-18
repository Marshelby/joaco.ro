import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DeliveryOrderCard } from "@/components/admin/delivery-order-card";
import { DeliveryProductsSummary } from "@/components/admin/delivery-products-summary";
import { EmptyState } from "@/components/feedback/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { ActionLink } from "@/components/ui/action-link";
import { formatFechaEntregaLarga } from "@/lib/delivery-date";
import { obtenerDetalleEntregaAdmin } from "@/lib/admin/pedidos";
import { formatCLP } from "@/lib/formatters";

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
            <div className="rounded-xl border border-border bg-card p-4"><p className="text-sm text-muted-foreground">Total previsto</p><p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">{formatCLP(entrega.total)}</p></div>
            <div className="rounded-xl border border-border bg-card p-4"><p className="text-sm text-muted-foreground">Clientes</p><p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">{entrega.cantidadClientes}</p></div>
          </section>

          <DeliveryProductsSummary productos={entrega.resumenProductos} />
          {entrega.resumenFaltantes.length > 0 ? <section className="rounded-xl border border-destructive/25 bg-card p-4"><h2 className="font-semibold text-foreground">Faltantes de la jornada</h2><p className="mt-1 text-sm text-muted-foreground">{entrega.resumenFaltantes.length} líneas con faltantes</p><ul className="mt-3 space-y-1 text-sm">{entrega.resumenFaltantes.map((item) => <li key={item.id}>{item.nombreProducto} — faltan {item.cantidadFaltante}</li>)}</ul></section> : null}

          <section className="space-y-4" aria-labelledby="pedidos-jornada-title">
            <div><h2 id="pedidos-jornada-title" className="text-xl font-semibold tracking-tight text-foreground">Pedidos</h2><p className="mt-1 text-sm text-muted-foreground">Ordenados por creación; todavía no representa una ruta logística.</p></div>
            <ul className="space-y-3" aria-label="Pedidos de la jornada">
              {entrega.pedidos.map((pedido) => <DeliveryOrderCard key={pedido.id} pedido={pedido} />)}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
