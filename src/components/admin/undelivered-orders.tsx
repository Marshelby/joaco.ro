import { obtenerUltimosFallosEntrega } from "@/lib/admin/intentos-entrega";
import { DeliveryResult, DeliveryResultDetails, importeResultado, presentarResultadoEntrega, productoSolicitado } from "@/components/admin/delivery-result";
import { UndeliveredHistoryLink, UndeliveredScrollRestoration } from "@/components/admin/undelivered-history-navigation";
import { UndeliveredOrderActions } from "@/components/admin/undelivered-order-actions";
import { ActionLink } from "@/components/ui/action-link";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/feedback/empty-state";
import { obtenerFechasSolicitudNoEntregados, obtenerNoEntregados, obtenerNoEntregadosSinFiltros, type FiltrosNoEntregados } from "@/lib/admin/no-entregados";

export async function UndeliveredOrders({ filtros }: { filtros: FiltrosNoEntregados }) {
  const resultado = filtros.q || filtros.desde || filtros.hasta || filtros.pagina
    ? await obtenerNoEntregados(filtros)
    : await obtenerNoEntregadosSinFiltros();
  const [fallos, fechasSolicitud] = await Promise.all([
    obtenerUltimosFallosEntrega(resultado.pedidos.filter(p => !p.historico).map(p => p.id)),
    obtenerFechasSolicitudNoEntregados(resultado.pedidos).catch(() => new Map<string, string>()),
  ]);
  const hrefPagina = (pagina: number) => `/admin/pedidos?${new URLSearchParams({ filtro: "no-entregados", q: filtros.q ?? "", desde: filtros.desde ?? "", hasta: filtros.hasta ?? "", pagina: String(pagina) })}`;
  const inputClass = "mt-1 min-h-9 w-full rounded-lg border border-input bg-background px-3 text-sm";
  return <section className="space-y-3" aria-labelledby="no-entregados-title">
    <UndeliveredScrollRestoration />
    <div><h2 id="no-entregados-title" className="text-base font-semibold">No entregados</h2>
      <p className="mt-1 text-sm text-muted-foreground">Pedidos cuyo estado operativo vigente es entrega fallida. Los montos son informativos; esta consulta no reconoce ventas ni genera deuda.</p></div>
    <form action="/admin/pedidos" method="get" className="grid gap-2 rounded-lg border bg-card p-2.5 sm:grid-cols-2 lg:grid-cols-4">
      <input type="hidden" name="filtro" value="no-entregados" />
      <label className="text-sm font-medium">Cliente o número de pedido<input className={inputClass} type="search" name="q" maxLength={200} defaultValue={filtros.q} placeholder="Buscar pedido" /></label>
      <label className="text-sm font-medium">Entrega original desde<input className={inputClass} type="date" name="desde" defaultValue={filtros.desde} /></label>
      <label className="text-sm font-medium">Entrega original hasta<input className={inputClass} type="date" name="hasta" defaultValue={filtros.hasta} /></label>
      <div className="flex flex-wrap items-end gap-2"><Button type="submit" className="h-9 text-xs">Filtrar</Button><ActionLink href="/admin/pedidos?filtro=no-entregados" variant="quiet" className="min-h-9 text-xs">Limpiar</ActionLink></div>
    </form>
    <p className="text-sm text-muted-foreground">Los históricos carecen de un intento fallido auditado y requieren revisión. “Pendiente de resolución” identifica fallos con evidencia operativa; no significa pedido pendiente de entrega.</p>
    {resultado.error ? <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">{resultado.error}</div> : <>
      <p role="status" className="text-sm text-muted-foreground">{resultado.total} pedidos · Página {resultado.pagina}</p>
      {resultado.pedidos.length ? <ul className="space-y-1.5" aria-label="Pedidos no entregados">{resultado.pedidos.map(p => {
        const datos = presentarResultadoEntrega("entrega_fallida", p.total, null,
          p.productos.map((producto, i) => productoSolicitado(String(i), producto.nombre, producto.presentacion, producto.unidad, producto.cantidad)));
        const fallo = fallos.get(p.id);
        return <li key={p.id} className="min-w-0">
          <DeliveryResult tipo={datos.tipo} cliente={p.cliente} numero={p.numero_pedido} importe={importeResultado(datos)}
            compact={{
              solicitud: fechasSolicitud.get(p.id),
              entrega: p.fecha_entrega,
              acciones: <>
                <ActionLink href={`/admin/pedidos/detalle/${p.id}`} scroll={false} prefetch={false} variant="quiet">Ver pedido completo</ActionLink>
                <UndeliveredHistoryLink pedidoId={p.id} retorno={hrefPagina(resultado.pagina)} />
              </>,
            }}>
            <p className="text-xs text-muted-foreground">{p.historico ? "Histórico · revisar evidencia" : "Pendiente de resolución"}</p>
            <DeliveryResultDetails datos={datos} fallo={{ motivo: p.motivo, observaciones: p.observaciones, fecha: p.fecha_fallo, actor: fallo?.fecha === p.fecha_fallo ? fallo?.actor ?? "Responsable no registrado" : "Responsable no registrado" }} />
            <UndeliveredOrderActions pedidoId={p.id} historico={p.historico} />
          </DeliveryResult>
        </li>;
      })}</ul> : <EmptyState title="Sin pedidos no entregados" description="No hay resultados para los filtros seleccionados." />}
      <nav aria-label="Páginas de pedidos no entregados" className="flex flex-wrap gap-3">{resultado.pagina > 1 ? <ActionLink href={hrefPagina(resultado.pagina - 1)} variant="secondary">Anterior</ActionLink> : null}{resultado.pagina * 20 < resultado.total ? <ActionLink href={hrefPagina(resultado.pagina + 1)} variant="secondary">Siguiente</ActionLink> : null}</nav>
    </>}
  </section>;
}
