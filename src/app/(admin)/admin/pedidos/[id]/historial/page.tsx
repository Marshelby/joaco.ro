import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ActionLink } from "@/components/ui/action-link";
import { obtenerHistorialPedido } from "@/lib/admin/pedido-historial";
import { DELIVERY_TIME_ZONE } from "@/config/delivery-schedule";

export const metadata: Metadata = { title: "Historial del pedido" };

const fechaChile = new Intl.DateTimeFormat("es-CL", {
  timeZone: DELIVERY_TIME_ZONE, dateStyle: "long", timeStyle: "medium", hour12: false,
});

export default async function HistorialPedidoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound();
  const historial = await obtenerHistorialPedido(id);
  if (!historial) notFound();

  return <div className="space-y-6">
    <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
      <div><h1 className="text-2xl font-semibold">Historial del pedido {historial.numeroPedido}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Orden cronológico · Hora de Chile ({DELIVERY_TIME_ZONE}). Solo registros existentes.</p></div>
      <ActionLink href={`/admin/pedidos/${id}`} variant="secondary">Volver al pedido</ActionLink>
    </header>
    <div className="space-y-2 rounded-xl border bg-card p-4 text-sm text-muted-foreground">
      <p>Los registros confirmados acreditan la operación indicada. Los avances de preparación y la planificación son provisionales; no representan una entrega ni una venta definitiva.</p>
      <p>Los estados actuales se indican expresamente. Solo se muestran valores anteriores y nuevos cuando están conservados. Puede haber operaciones históricas sin auditoría disponible.</p>
      <p>Los ajustes de cuenta del cliente no tienen una relación directa con este pedido y no se atribuyen a su historial. Los ajustes de precio vinculados a sus productos sí se incluyen.</p>
    </div>
    <ol aria-label="Línea de tiempo del pedido" className="ml-2 space-y-5 border-l-2 border-border pl-5 sm:pl-8">
      {historial.eventos.map((evento) => <li key={evento.id} className="relative min-w-0 rounded-xl border bg-card p-4 sm:p-5">
        <span aria-hidden="true" className="absolute -left-[1.75rem] top-6 size-3 rounded-full border-2 border-background bg-primary sm:-left-[2.5rem]" />
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h2 className="font-semibold">{evento.tipo}</h2>
          <span className={`rounded-full px-2 py-1 text-xs font-medium ${evento.provisional ? "bg-amber-100 text-amber-950 dark:bg-amber-950 dark:text-amber-100" : "bg-primary/10 text-primary"}`}>{evento.provisional ? "Provisional / pendiente" : "Registro confirmado"}</span>
        </div>
        <time dateTime={evento.fecha} className="mt-2 block text-sm text-muted-foreground">{fechaChile.format(new Date(evento.fecha))}</time>
        {evento.actor ? <p className="mt-2 break-all text-xs text-muted-foreground">Actor (ID): {evento.actor}</p> : null}
        {evento.detalles.length ? <ul className="mt-3 space-y-2 text-sm leading-6 [overflow-wrap:anywhere]">{evento.detalles.map((detalle, indice) => <li key={indice}>{detalle}</li>)}</ul> : null}
      </li>)}
    </ol>
  </div>;
}
