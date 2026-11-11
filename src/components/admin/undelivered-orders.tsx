import { UndeliveredOrderActions } from "@/components/admin/undelivered-order-actions";
import { ActionLink } from "@/components/ui/action-link";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/feedback/empty-state";
import { obtenerNoEntregados, type FiltrosNoEntregados } from "@/lib/admin/no-entregados";
import { formatCLP, formatDateTimeCL } from "@/lib/formatters";
import { formatFechaEntregaLarga } from "@/lib/delivery-date";

export async function UndeliveredOrders({ filtros }: { filtros: FiltrosNoEntregados }) {
  const resultado = await obtenerNoEntregados(filtros);
  const hrefPagina = (pagina: number) => `/admin/pedidos?${new URLSearchParams({ filtro: "no-entregados", q: filtros.q ?? "", desde: filtros.desde ?? "", hasta: filtros.hasta ?? "", pagina: String(pagina) })}`;
  const inputClass = "mt-1 min-h-11 w-full rounded-lg border border-input bg-background px-3 text-sm";
  return <section className="space-y-5" aria-labelledby="no-entregados-title">
    <div><h2 id="no-entregados-title" className="text-2xl font-semibold">No entregados</h2>
      <p className="mt-2 text-sm text-muted-foreground">Pedidos cuyo estado operativo vigente es entrega fallida. Los montos son informativos; esta consulta no reconoce ventas ni genera deuda.</p></div>
    <form action="/admin/pedidos" method="get" className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
      <input type="hidden" name="filtro" value="no-entregados" />
      <label className="text-sm font-medium">Cliente o número de pedido<input className={inputClass} type="search" name="q" maxLength={200} defaultValue={filtros.q} placeholder="Buscar pedido" /></label>
      <label className="text-sm font-medium">Entrega original desde<input className={inputClass} type="date" name="desde" defaultValue={filtros.desde} /></label>
      <label className="text-sm font-medium">Entrega original hasta<input className={inputClass} type="date" name="hasta" defaultValue={filtros.hasta} /></label>
      <div className="flex flex-wrap items-end gap-2"><Button type="submit">Filtrar</Button><ActionLink href="/admin/pedidos?filtro=no-entregados" variant="quiet">Limpiar</ActionLink></div>
    </form>
    <p className="text-sm text-muted-foreground">Los históricos carecen de un intento fallido auditado y requieren revisión. “Pendiente de resolución” identifica fallos con evidencia operativa; no significa pedido pendiente de entrega.</p>
    {resultado.error ? <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">{resultado.error}</div> : <>
      <p role="status" className="text-sm text-muted-foreground">{resultado.total} pedidos · Página {resultado.pagina}</p>
      {resultado.pedidos.length ? <ul className="space-y-4" aria-label="Pedidos no entregados">{resultado.pedidos.map(p => <li key={p.id} className="min-w-0 space-y-4 rounded-xl border bg-card p-4 [overflow-wrap:anywhere] sm:p-5">
        <div className="flex flex-wrap justify-between gap-3"><div><h3 className="font-semibold">Pedido {p.numero_pedido}</h3><p className="mt-1">{p.cliente}</p></div><div className="flex flex-wrap items-start gap-2"><span className="rounded-full bg-destructive/10 px-3 py-1 text-xs font-semibold text-destructive">No entregado</span><span className="rounded-full bg-muted px-3 py-1 text-xs font-medium">{p.historico ? "Histórico · revisar evidencia" : "Pendiente de resolución"}</span></div></div>
        <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div><dt className="text-muted-foreground">Entrega original del intento</dt><dd className="mt-1">{p.fecha_entrega ? formatFechaEntregaLarga(p.fecha_entrega) : "Sin fecha registrada"}</dd></div>
          <div><dt className="text-muted-foreground">Intento fallido</dt><dd className="mt-1">{p.fecha_fallo ? formatDateTimeCL(p.fecha_fallo) : "Sin intento auditado disponible"}</dd></div>
          <div><dt className="text-muted-foreground">Motivo</dt><dd className="mt-1">{p.motivo ?? "Sin motivo auditado disponible"}{p.observaciones ? <p className="mt-1 text-muted-foreground">{p.observaciones}</p> : null}</dd></div>
          <div><dt className="text-muted-foreground">Monto original informativo</dt><dd className="mt-1 font-semibold">{formatCLP(p.total)}</dd></div>
        </dl>
        <details className="border-t pt-3"><summary className="min-h-11 cursor-pointer text-sm font-medium">Productos ({p.productos.length})</summary><ul className="space-y-2 text-sm">{p.productos.map((producto, i) => <li key={i}>{producto.nombre}{producto.presentacion ? ` · ${producto.presentacion}` : ""} · {producto.cantidad} {producto.unidad}</li>)}</ul></details>
        <div className="flex flex-wrap gap-2"><ActionLink href={`/admin/pedidos/${p.id}`} variant="secondary">Ver pedido completo</ActionLink><ActionLink href={`/admin/pedidos/${p.id}/historial`} variant="quiet">Historial operativo</ActionLink></div>
        <UndeliveredOrderActions pedidoId={p.id} historico={p.historico} />
      </li>)}</ul> : <EmptyState title="Sin pedidos no entregados" description="No hay resultados para los filtros seleccionados." />}
      <nav aria-label="Páginas de pedidos no entregados" className="flex flex-wrap gap-3">{resultado.pagina > 1 ? <ActionLink href={hrefPagina(resultado.pagina - 1)} variant="secondary">Anterior</ActionLink> : null}{resultado.pagina * 20 < resultado.total ? <ActionLink href={hrefPagina(resultado.pagina + 1)} variant="secondary">Siguiente</ActionLink> : null}</nav>
    </>}
  </section>;
}
