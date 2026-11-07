import type { Metadata } from "next";
import { RutaDiaMap } from "./ruta-dia-map";
import { JornadaModos } from "./jornada-modos";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DeliveryOrderCard } from "@/components/admin/delivery-order-card";
import { DeliveryProductsSummary } from "@/components/admin/delivery-products-summary";
import { JornadaCargaControl } from "@/components/admin/jornada-carga-control";
import { EmptyState } from "@/components/feedback/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { ActionLink } from "@/components/ui/action-link";
import { Button } from "@/components/ui/button";
import { leerCargaJornada } from "@/lib/admin/cargas";
import { formatearCantidadConUnidadEntrega, obtenerCoordenadasRuta, obtenerConteoPedidosPorFecha, obtenerDetalleEntregaAdmin, obtenerFechaLocalActual } from "@/lib/admin/pedidos";
import { formatFechaEntregaCorta, formatFechaEntregaLarga } from "@/lib/delivery-date";
import { formatCLP } from "@/lib/formatters";
import { obtenerPermisoTemporalPreparacion } from "@/lib/order-preparation";

export const metadata: Metadata = { title: "Rutas" };

function fechaValida(fecha: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(fecha)
    && Number(fecha.slice(0, 4)) >= 1
    && !Number.isNaN(Date.parse(`${fecha}T12:00:00Z`))
    && new Date(`${fecha}T12:00:00Z`).toISOString().slice(0, 10) === fecha;
}

export default async function AdminRoutesPage({ searchParams }: {
  searchParams: Promise<{ fecha?: string | string[] }>;
}) {
  const params = await searchParams;
  const hoy = obtenerFechaLocalActual();
  const fecha = params.fecha ?? hoy;
  if (typeof fecha !== "string" || !fechaValida(fecha)) notFound();
  // Aritmética de días civiles, independiente del cambio de hora de Santiago.
  const dias = Array.from({ length: 7 }, (_, indice) => {
    const dia = new Date(`${hoy}T12:00:00Z`);
    dia.setUTCDate(dia.getUTCDate() + indice);
    return dia.toISOString().slice(0, 10);
  });
  const [entrega, carga, conteo] = await Promise.all([
    obtenerDetalleEntregaAdmin(fecha), leerCargaJornada(fecha),
    obtenerConteoPedidosPorFecha(hoy, dias[6]),
  ]);
  const coordenadas = await obtenerCoordenadasRuta(entrega.pedidos.map((pedido) => pedido.id));
  const permiso = obtenerPermisoTemporalPreparacion(fecha);
  const productos = entrega.pedidos.flatMap((pedido) => pedido.items);
  const confirmados = productos.filter((item) => item.confirmadoExplicito).length;
  const totalProvisional = entrega.pedidos.reduce((total, pedido) => total + (pedido.importeOperativoPreparacion ?? pedido.totalFinal ?? pedido.total), 0);
  const listos = entrega.pedidos.filter((pedido) => pedido.estado === "listo_despacho").length;
  const enRuta = entrega.pedidos.filter((pedido) => pedido.estado === "en_reparto").length;

  return <div className="space-y-6">
    <PageHeader title="Rutas" description="Preparación y reparto · Hidro Leufú" actions={<ActionLink href="/admin/pedidos" variant="secondary">Ver pedidos</ActionLink>} />
    <section className="space-y-4 rounded-xl border border-border bg-card p-4" aria-label="Fecha de operación">
      <nav className="flex gap-2 overflow-x-auto pb-2" aria-label="Próximos siete días">
        {dias.map((dia) => <Link key={dia} prefetch={false} href={`/admin/rutas?fecha=${dia}`} aria-current={dia === fecha ? "date" : undefined}
          className={`min-w-28 flex-1 rounded-lg border p-3 text-center text-sm focus-visible:outline-2 focus-visible:outline-ring ${dia === fecha ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted"}`}>
          <span className="block font-semibold">{dia === hoy ? "Hoy" : formatFechaEntregaCorta(dia)}</span>
          {dia === hoy ? <span className="block text-xs">{formatFechaEntregaCorta(dia)}</span> : null}
          <span className={`mt-2 block text-xs ${conteo[dia] ? "font-semibold text-primary" : "text-muted-foreground"}`}>{conteo[dia] ? `${conteo[dia]} pedidos` : "Sin pedidos"}</span>
        </Link>)}
      </nav>
      <form action="/admin/rutas" method="get" className="flex flex-wrap items-end gap-3">
        <label className="min-w-0 text-sm font-medium" htmlFor="fecha-ruta">Consultar otra fecha<input id="fecha-ruta" name="fecha" type="date" required defaultValue={fecha} key={fecha} className="mt-1 block min-h-11 rounded-lg border border-input bg-background px-3" /></label>
        <Button type="submit" variant="secondary">Consultar</Button>
      </form>
    </section>
    <JornadaModos key={fecha} titulo={formatFechaEntregaLarga(fecha)} mensaje={permiso.permitida ? permiso.mensaje : `Solo consulta. ${permiso.mensaje}`} preparacion={<>
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Resumen operativo">
      {[
        ["Pedidos", String(entrega.pedidos.length)],
        ["Productos confirmados", `${confirmados} / ${productos.length}`],
        ["Total provisional", formatCLP(totalProvisional)],
        ["Listos / en reparto", `${listos} / ${enRuta}`],
      ].map(([titulo, valor]) => <div key={titulo} className="rounded-xl border bg-card p-4"><p className="text-xs text-muted-foreground">{titulo}</p><p className="mt-1 break-words text-xl font-semibold">{valor}</p></div>)}
    </section>
    <p className="text-xs text-muted-foreground">Los importes son provisionales; las líneas pendientes conservan su importe original en el total. La fecha corresponde a la entrega efectiva, en America/Santiago.</p>
    {entrega.pedidos.length === 0 ? <EmptyState title="No hay pedidos para esta fecha" description="Los pedidos con fecha efectiva de entrega aparecerán aquí, desde su recepción." /> : <>
      <section aria-label="Pedidos de la fecha" className="space-y-3">
        <h2 className="text-lg font-semibold">Preparación de pedidos</h2>
        <ul className="space-y-3">{entrega.pedidos.map((pedido) => <DeliveryOrderCard key={pedido.id} pedido={pedido} operativa />)}</ul>
      </section>
      <details className="rounded-xl border bg-card p-4"><summary className="min-h-11 cursor-pointer py-2 font-semibold">Productos solicitados de la jornada</summary><DeliveryProductsSummary productos={entrega.resumenProductos} variant="compact" /></details>
    </>}
    <JornadaCargaControl key={`${fecha}-${carga.version}-${JSON.stringify(carga.pedidos)}`} fecha={fecha} carga={carga} habilitada={permiso.permitida} identidades={Object.fromEntries(entrega.pedidos.map((pedido) => [pedido.id, { nombreClienteSnapshot: pedido.nombreClienteSnapshot, nombreUbicacionSnapshot: pedido.nombreUbicacionSnapshot, numeroPedido: pedido.numeroPedido }]))} />
    </>} ruta={entrega.pedidos.length === 0 ? <EmptyState title="No hay pedidos para esta fecha" description="Los pedidos con fecha efectiva de entrega aparecerán aquí, desde su recepción." /> : <section aria-label="Ruta del día" className="space-y-3">
      <RutaDiaMap fecha={fecha} paradas={entrega.pedidos.map((pedido, indice) => ({
        id: pedido.id, numero: indice + 1, cliente: pedido.nombreClienteSnapshot,
        ubicacion: pedido.nombreUbicacionSnapshot, pedido: pedido.numeroPedido,
        entregado: pedido.estado === "entregado",
        ...(coordenadas.get(pedido.id) ?? { latitude: null, longitude: null }),
        detalle: (
              <div className="space-y-3 border-t border-current/10 p-3">
                <p className="text-xs text-muted-foreground">Pedido {pedido.numeroPedido}</p>
                <details className="rounded-lg border border-border p-3">
                  <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold">Ver productos</summary>
                  {pedido.items.length === 0 ? <p className="py-2 text-sm text-muted-foreground">No hay productos registrados en este pedido.</p> : <ul className="divide-y divide-border">{pedido.items.map((producto) => <li key={producto.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"><span className="min-w-0 break-words font-medium">{producto.nombreProducto}{producto.nombrePresentacion ? ` · ${producto.nombrePresentacion}` : ""}</span><span>{new Intl.NumberFormat("es-CL", { maximumFractionDigits: 20 }).format(producto.cantidadPreparada ?? 0)} / {formatearCantidadConUnidadEntrega(producto.cantidad, producto.unidad)}</span></li>)}</ul>}
                </details>
                <div className="flex flex-wrap gap-2" role="group" aria-label={`Acciones del pedido ${pedido.numeroPedido} (próximamente)`}>
                  {["Contactar", "Entregado", "No entregado"].map((accion) => <Button key={accion} type="button" variant="outline" disabled>{accion}</Button>)}
                </div>
              </div>
        ),
      }))} />
    </section>} />
  </div>;
}
