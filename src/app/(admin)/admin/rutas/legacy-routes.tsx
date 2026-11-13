import { DeliveryProductDetail, DeliveryOrderTotals } from "@/components/admin/delivery-product-detail";
import { DeliveryObservation } from "@/components/admin/delivery-observation";
import { CierreRutaDialog } from "./cierre-ruta-dialog";
import { RutaDiaMap } from "./ruta-dia-map";
import { JornadaModos } from "./jornada-modos";
import { EntregaFallidaDialog } from "./entrega-fallida-dialog";
import { leerDisponibilidadEntrega } from "./entrega-disponibilidad";
import { EntregaVisualDialog } from "./entrega-visual-dialog";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DeliveryOrderCard } from "@/components/admin/delivery-order-card";
import { DeliveryProductsSummary } from "@/components/admin/delivery-products-summary";
import { RutaPreparacionControl } from "./ruta-preparacion-control";
import { JornadaSalidaControl } from "@/components/admin/jornada-salida-control";
import { EmptyState } from "@/components/feedback/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { ActionLink } from "@/components/ui/action-link";
import { Button } from "@/components/ui/button";
import { leerCargaJornada } from "@/lib/admin/cargas";
import { obtenerCoordenadasRuta, obtenerConteoPedidosPorFecha, obtenerDetalleEntregaAdmin, obtenerFechaLocalActual } from "@/lib/admin/pedidos";
import { formatFechaEntregaCorta, formatFechaEntregaLarga } from "@/lib/delivery-date";
import { formatCLP } from "@/lib/formatters";
import { obtenerPermisoTemporalPreparacion } from "@/lib/order-preparation";



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
  const disponibilidadEntrega = await leerDisponibilidadEntrega(entrega.pedidos.map(pedido => pedido.id));
  for (const pedido of entrega.pedidos) {
    if (disponibilidadEntrega[pedido.id] !== null) continue;
    if (!Number.isSafeInteger(pedido.versionPreparacion) || pedido.versionPreparacion < 0 || pedido.versionPreparacion >= Number.MAX_SAFE_INTEGER) {
      disponibilidadEntrega[pedido.id] = "Recarga para verificar la versión operativa.";
    } else if (!pedido.items.length || pedido.items.some(item => !item.confirmadoExplicito || item.cantidadPreparada === null || item.importeOperativo === null)) {
      disponibilidadEntrega[pedido.id] = "La preparación tiene productos pendientes de cantidad o importe confirmado.";
    }
  }
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
    {(carga.estado === "en_ruta" && carga.salida_en) || carga.estado === "cerrada" ? <CierreRutaDialog key={fecha} fecha={fecha} cerrada={carga.estado === "cerrada"} /> : null}
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
        <ul className="space-y-2">{entrega.pedidos.map((pedido, indice) => <DeliveryOrderCard key={pedido.id} pedido={pedido} operativa rutaMultiple soloLecturaRuta={carga.estado !== "preparacion"} numeroPreparacion={indice + 1} />)}</ul>
      </section>
      <details className="rounded-xl border bg-card p-4"><summary className="min-h-11 cursor-pointer py-2 font-semibold">Productos solicitados de la jornada</summary><DeliveryProductsSummary productos={entrega.resumenProductos} variant="compact" /></details>
    </>}
    {carga.estado === "preparacion" && <RutaPreparacionControl key={`${fecha}-${carga.version}-${entrega.pedidos.map(p => p.versionPreparacion).join("-")}`} fecha={fecha} ruta={{ id: "", nombre: "Ruta de la jornada", version: carga.version, pedidos: entrega.pedidos.filter(p => !["cancelado", "entrega_fallida", "entregado", "en_reparto"].includes(p.estado)).map(p => p.id) }} pedidos={entrega.pedidos.filter(p => !["cancelado", "entrega_fallida", "entregado", "en_reparto"].includes(p.estado))} habilitada={permiso.permitida} />}
    </>} salida={<section className="space-y-3 rounded-xl border bg-card p-4"><h3 className="font-semibold">Despacho efectivo</h3><JornadaSalidaControl key={fecha} fecha={fecha} carga={carga} habilitada={permiso.permitida} /></section>} ruta={entrega.pedidos.length === 0 ? <EmptyState title="No hay pedidos para esta fecha" description="Los pedidos con fecha efectiva de entrega aparecerán aquí, desde su recepción." /> : <section aria-label="Ruta del día" className="space-y-3">
      <RutaDiaMap cerrada={carga.estado === "cerrada"} fecha={fecha} paradas={entrega.pedidos.filter(p => carga.pedidos.find(c => c.id === p.id)?.incluido !== false).map((pedido, indice) => ({
        id: pedido.id, numero: indice + 1, cliente: pedido.nombreClienteSnapshot,
        ubicacion: pedido.nombreUbicacionSnapshot, pedido: pedido.numeroPedido,
        entregado: pedido.estado === "entregado",
        fallida: pedido.estado === "entrega_fallida",
        ...(coordenadas.get(pedido.id) ?? { latitude: null, longitude: null }),
        detalle: (
              <div className="space-y-3 border-t border-current/10 p-3">
                <p className="text-xs text-muted-foreground">Pedido {pedido.numeroPedido}</p>
                <details className="rounded-lg border border-border p-3">
                  <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold">Ver productos</summary>
                  <ul className="divide-y divide-border">{pedido.items.map(item => <DeliveryProductDetail key={item.id} item={item} contexto={pedido.contextoEntrega} coloresLegacy />)}</ul>
                  <DeliveryOrderTotals pedido={pedido} />
                </details>
                <DeliveryObservation contexto={pedido.contextoEntrega} />
                <div className="flex flex-wrap gap-2" role="group" aria-label={`Acciones del pedido ${pedido.numeroPedido}`}>
                  <ActionLink href={`/admin/pedidos/${pedido.id}/historial`} variant="secondary">Ver historial</ActionLink>
                  <Button type="button" variant="outline" disabled>Contactar</Button>
                  <EntregaVisualDialog motivoBloqueo={disponibilidadEntrega[pedido.id]} habilitada={carga.estado !== "cerrada" && disponibilidadEntrega[pedido.id] === null} pedidoId={pedido.id} versionEsperada={pedido.versionPreparacion} numero={pedido.numeroPedido} cliente={pedido.nombreClienteSnapshot} items={pedido.items} totalReferencia={pedido.importeOperativoPreparacion ?? pedido.totalFinal ?? pedido.total} />
                  <EntregaFallidaDialog habilitada={carga.estado !== "cerrada" && pedido.estado === "en_reparto"} pedidoId={pedido.id} versionEsperada={pedido.versionPreparacion} numero={pedido.numeroPedido} cliente={pedido.nombreClienteSnapshot} ubicacion={pedido.nombreUbicacionSnapshot} productos={pedido.items.length} totalReferencia={pedido.importeOperativoPreparacion ?? pedido.totalFinal ?? pedido.total} />
                </div>
              </div>
        ),
      }))} />
    </section>} />
  </div>;
}
