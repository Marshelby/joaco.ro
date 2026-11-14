import { JornadaControles } from "@/components/admin/jornada-controles";
import { ROUTES } from "@/config/routes";
import { obtenerContabilidadRutas } from "@/lib/admin/rutas-contabilidad";
import { RutasContabilidadPedido, RutasContabilidadJornada } from "@/components/admin/rutas-contabilidad";
import { DeliveryProductDetail, DeliveryOrderTotals } from "@/components/admin/delivery-product-detail";
import { DeliveryObservation } from "@/components/admin/delivery-observation";
import { obtenerNombresResponsables, describirAccionRuta } from "@/lib/admin/responsables";
import type { Metadata } from "next";
import { RutasNavigation, RutasLink as Link, RutasFechaForm } from "./rutas-navigation";
import { notFound } from "next/navigation";
import { exigirAdminReparto } from "@/lib/reparto/server";
import { obtenerDetalleEntregaAdmin, obtenerFechaLocalActual, obtenerCoordenadasRuta, obtenerConteoPedidosPorFecha } from "@/lib/admin/pedidos";
import { obtenerPermisoTemporalPreparacion } from "@/lib/order-preparation";
import { formatFechaEntregaCorta, formatFechaEntregaLarga } from "@/lib/delivery-date";
import { PageHeader } from "@/components/shared/page-header";
import { RutaPreparacionControl } from "./ruta-preparacion-control";
import { DeliveryOrderCard } from "@/components/admin/delivery-order-card";
import { DeliveryProductsSummary } from "@/components/admin/delivery-products-summary";
import { ActionLink } from "@/components/ui/action-link";
import { RutaMultipleForm } from "./multiple-controls";
import { RutaDiaMap } from "./ruta-dia-map";
import { EntregaVisualDialog } from "./entrega-visual-dialog";
import { EntregaFallidaDialog } from "./entrega-fallida-dialog";
import { leerDisponibilidadEntrega } from "./entrega-disponibilidad";
import { JornadaModos } from "./jornada-modos";
import LegacyRoutesPage from "./legacy-routes";
import type { RutasMultiples, SolicitudRutaMultiple } from "./multiple-types";

export const metadata: Metadata = { title: "Rutas" };
async function AdminRoutesContent({ searchParams }: { searchParams: Promise<{ fecha?: string | string[]; ruta?: string | string[] }> }) {
  const params = await searchParams;
  const hoy = obtenerFechaLocalActual();
  const fecha = params.fecha ?? hoy;
  if (typeof fecha !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !Number.isFinite(Date.parse(`${fecha}T12:00:00Z`)) || new Date(`${fecha}T12:00:00Z`).toISOString().slice(0, 10) !== fecha || fecha.startsWith("0000")) notFound();
  const db = await exigirAdminReparto();
  const { data, error } = await db.rpc("leer_rutas_multiples", { p_fecha: fecha });
  if (error || data?.contrato !== 3 || !Array.isArray(data.rutas) || !Array.isArray(data.repartidores)) {
    const consulta = await obtenerDetalleEntregaAdmin(fecha);
    const contabilidad = await obtenerContabilidadRutas(fecha, consulta.pedidos.map(p => p.id));
    return <div className="space-y-4"><PageHeader title="Rutas" description="Preparación y reparto · Hidro Leufú" /><p role="alert" className="rounded-xl border bg-card p-4">Rutas múltiples no disponibles. Falta instalar el SQL manual de Fase 3 o no se pudo verificar el contrato. La operación de rutas permanece bloqueada hasta verificar la instalación.</p><RutasFechaForm className="flex flex-wrap gap-3"><label>Fecha<input type="date" name="fecha" required defaultValue={fecha} key={fecha} className="ml-2 min-h-11 rounded-lg border bg-background p-2" /></label><button className="min-h-11 rounded-lg border px-3">Consultar</button></RutasFechaForm><h2 data-rutas-destino="fecha" className="scroll-mt-24 font-semibold">{formatFechaEntregaLarga(fecha)} · {consulta.pedidos.length} pedidos</h2><JornadaControles key={fecha} productos={<DeliveryProductsSummary productos={consulta.resumenProductos} variant="compact" />} contabilidad={<RutasContabilidadJornada datos={contabilidad} pedidos={consulta.pedidos} />} /><ul className="space-y-3">{consulta.pedidos.map((p, n) => <DeliveryOrderCard key={p.id} pedido={p} resumenContable={<RutasContabilidadPedido resumen={contabilidad?.[p.id]} />} operativa numeroPreparacion={n + 1} rutaMultiple soloLecturaRuta />)}</ul><ActionLink href="/admin/pedidos" variant="secondary">Ver pedidos</ActionLink></div>;
  }
  const modelo = data as RutasMultiples;
  if (modelo.legado) return <><p className="mb-4 rounded-xl border bg-card p-4 text-sm">Esta fecha conserva una jornada del sistema anterior. Se mantiene su historial y su operación original; las rutas múltiples se habilitan en fechas sin carga previa.</p><LegacyRoutesPage searchParams={Promise.resolve({ fecha })} /></>;
  if (params.ruta !== undefined && typeof params.ruta !== "string") notFound();
  const ruta = modelo.rutas.find(r => r.id === params.ruta);
  if (params.ruta && !ruta) notFound();
  const nombreResponsable = await obtenerNombresResponsables(modelo.rutas.flatMap(r => r.historial.map(e => e.actor)));
  const entrega = await obtenerDetalleEntregaAdmin(fecha);
  const contabilidad = await obtenerContabilidadRutas(fecha, entrega.pedidos.map(p => p.id));
  const dias = Array.from({ length: 7 }, (_, n) => { const d = new Date(`${hoy}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); });
  const conteo = await obtenerConteoPedidosPorFecha(hoy, dias[6]);
  const asignados = new Set(modelo.rutas.flatMap(r => r.pedidos));
  const disponibles = entrega.pedidos.filter(p => !asignados.has(p.id) && ["recibido", "en_revision", "programado", "confirmado", "preparando", "listo_despacho"].includes(p.estado));
  const porId = new Map(entrega.pedidos.map(p => [p.id, p]));
  const pedidos = ruta ? ruta.pedidos.flatMap(id => { const p = porId.get(id); return p ? [p] : []; }) : entrega.pedidos;
  const editable = !!ruta && ["planificacion", "preparacion"].includes(ruta.estado);
  const permiso = obtenerPermisoTemporalPreparacion(fecha);
  const [coordenadas, disponibilidad] = await Promise.all([obtenerCoordenadasRuta(pedidos.map(p => p.id)), leerDisponibilidadEntrega(pedidos.map(p => p.id))]);
  const autorizacionVigente = (p: (typeof pedidos)[number]) => ruta?.autorizaciones.find(a =>
    a.pedido === p.id && a.version === p.versionPreparacion && a.cantidades.length === p.items.length &&
    p.items.every(i => a.cantidades.some(c => c.item === i.id && c.solicitada === i.cantidad && c.preparada === i.cantidadPreparada)));
  const bloqueosSalida = pedidos.flatMap(p => {
    if (!p.items.length || !p.items.some(i => (i.cantidadPreparada ?? 0) > 0)) return [`${p.numeroPedido}: prepara productos o resuelve expresamente la falta total de stock.`];
    if (p.items.some(i => !i.confirmadoExplicito || i.cantidadPreparada === null || i.importeOperativo === null)) return [`${p.numeroPedido}: confirma la preparación de la ruta.`];
    if (p.estado !== "listo_despacho") return [`${p.numeroPedido}: confirma la preparación de la ruta.`];
    if (p.items.some(i => i.cantidadPreparada !== i.cantidad) && !autorizacionVigente(p)) return [`${p.numeroPedido}: confirma la preparación de la ruta para registrar las diferencias.`];
    return [];
  });
  const rutaLista = pedidos.length > 0 && bloqueosSalida.length === 0;
  const comando = (accion: SolicitudRutaMultiple["accion"]) => ({ accion, ruta: ruta!.id, fecha, version: ruta!.version });
  return <div className="space-y-4">
    <PageHeader title="Rutas" description="Preparación y reparto · Hidro Leufú" actions={<ActionLink href="/admin/pedidos" variant="secondary">Ver pedidos</ActionLink>} />
    <section className="space-y-4 rounded-xl border bg-card p-4">
      <nav className="flex gap-2 overflow-x-auto pb-2" aria-label="Próximos siete días">{dias.map(d => <Link key={d} prefetch={false} href={`/admin/rutas?fecha=${d}`} aria-current={d === fecha ? "date" : undefined} className={`min-w-28 flex-1 rounded-lg border p-3 text-center text-sm ${d === fecha ? "border-primary bg-primary/10 text-primary" : "border-border"}`}><span className="block font-semibold">{d === hoy ? "Hoy" : formatFechaEntregaCorta(d)}</span><span>{conteo[d] ?? 0} pedidos</span></Link>)}</nav>
      <RutasFechaForm className="flex flex-wrap items-end gap-3"><label className="text-sm">Consultar fecha<input name="fecha" type="date" required defaultValue={fecha} key={fecha} className="mt-1 block min-h-11 rounded-lg border bg-background px-3" /></label><button className="min-h-11 rounded-lg border px-4">Consultar</button></RutasFechaForm>
      <h2 data-rutas-destino="fecha" className="scroll-mt-24 font-semibold">{formatFechaEntregaLarga(fecha)}</h2>
      <dl className="grid grid-cols-2 gap-2 lg:grid-cols-4" aria-label="Resumen operativo de jornada">{[
        ["Pedidos del día", entrega.pedidos.length], ["Sin asignar · disponibles", disponibles.length],
        ["Rutas activas", modelo.rutas.filter(r => r.estado !== "cerrada").length],
        ["Entregados / no entregados", `${entrega.pedidos.filter(p => p.estado === "entregado").length} / ${entrega.pedidos.filter(p => p.estado === "entrega_fallida").length}`],
      ].map(([t, v]) => <div key={t} className="rounded-lg bg-muted/40 px-3 py-2"><dt className="text-xs text-muted-foreground">{t}</dt><dd className="mt-1 text-lg font-semibold tabular-nums">{v}</dd></div>)}</dl>
      <JornadaControles key={fecha} crear={<RutaMultipleForm key={`crear-${modelo.rutas.length}`} comando={{ accion: "crear", ruta: "", fecha, version: 0 }} etiqueta="Crear ruta"><label className="block text-sm">Nombre o número de ruta<input name="nombre" required maxLength={100} placeholder="Ruta 1 · Centro" className="mt-1 min-h-11 w-full rounded-lg border bg-background p-2" /></label></RutaMultipleForm>} productos={<DeliveryProductsSummary productos={entrega.resumenProductos} variant="compact" />} contabilidad={<RutasContabilidadJornada datos={contabilidad} pedidos={entrega.pedidos} />} />
    </section>
    <nav className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3" aria-label="Rutas creadas">
      <Link destinoListado href={`/admin/rutas?fecha=${fecha}`} aria-current={!ruta ? "page" : undefined} className="rounded-xl border bg-card p-4 font-semibold">Todos los pedidos del día ({entrega.pedidos.length})</Link>
      {modelo.rutas.map(r => <Link key={r.id} href={`/admin/rutas?fecha=${fecha}&ruta=${r.id}`} aria-current={r.id === ruta?.id ? "page" : undefined} className={`min-w-0 space-y-3 rounded-xl border bg-card p-3 transition-colors hover:bg-muted/30 focus-visible:outline-2 focus-visible:outline-ring ${r.id === ruta?.id ? "border-primary ring-1 ring-primary" : ""}`}>
        <div className="flex flex-wrap items-center justify-between gap-2"><span className="break-words font-semibold">{r.nombre}</span><span className={`rounded-md px-2 py-1 text-xs font-semibold ${r.estado === "en_reparto" ? "bg-primary/10 text-primary" : r.estado === "cerrada" ? "bg-emerald-100 text-emerald-900" : "bg-muted text-muted-foreground"}`}>{{planificacion: "Planificación", preparacion: "Preparación", en_reparto: "En reparto", cerrada: "Cerrada"}[r.estado]}</span></div>
        <div className="grid grid-cols-3 gap-2 text-xs tabular-nums"><span><strong className="block text-base">{r.pedidos.length}</strong>Pedidos</span><span><strong className="block text-base">{r.contadores.preparados}</strong>Preparados</span><span><strong className="block text-base">{r.contadores.pendientes}</strong>Sin resolver</span></div>
        <p className="text-xs text-muted-foreground">Sin preparar {r.contadores.sin_preparar} · Parciales {r.contadores.parciales} · Pendientes de entrega {r.contadores.pendientes_entrega} · En reparto {r.contadores.en_reparto} · Entregados {r.contadores.entregados} · No entregados {r.contadores.no_entregados}</p>
      </Link>)}
    </nav>
    {ruta && <section className="space-y-4 rounded-xl border bg-card p-4">
      <h2 data-rutas-destino="ruta" className="scroll-mt-24 text-lg font-semibold">{ruta.nombre}</h2>
      <ol className="grid grid-cols-2 gap-2 text-sm lg:grid-cols-4" aria-label="Etapas de la ruta">{[
        { nombre: "Preparación", actual: editable, detalle: `${ruta.contadores.preparados} preparados · ${ruta.contadores.parciales} parciales` },
        { nombre: "Ruta lista", actual: ruta.estado === "preparacion" && rutaLista, detalle: `${rutaLista ? "Preparación confirmada" : "Preparación pendiente"} · ${ruta.repartidores.length ? "Repartidores asignados" : "Falta repartidor"}` },
        { nombre: "En reparto", actual: ruta.estado === "en_reparto", detalle: `${ruta.contadores.pendientes} pedidos sin resolver` },
        { nombre: "Cierre", actual: ruta.estado === "cerrada", detalle: ruta.estado === "cerrada" ? "Ruta cerrada" : "Disponible al resolver todos los pedidos" },
      ].map(etapa => <li key={etapa.nombre} className={`rounded-lg border p-3 ${etapa.actual ? "border-primary bg-primary/10" : "border-border bg-muted/30"}`}><p className="font-semibold">{etapa.nombre}</p><p className="mt-1 text-xs text-muted-foreground">{etapa.detalle}</p></li>)}</ol>
      <p className="text-sm">Repartidores: {ruta.repartidores.map(id => modelo.repartidores.find(r => r.usuario_id === id)?.nombre ?? "Repartidor no habilitado").join(", ") || "Sin asignar"}</p>
      {editable && <div className="grid gap-5 lg:grid-cols-2">
        <details><summary className="min-h-11 cursor-pointer py-2 font-semibold">Seleccionar pedidos</summary><RutaMultipleForm key={`seleccion-${ruta.id}-${ruta.version}`} comando={comando("seleccionar")} etiqueta="Guardar selección"><input type="hidden" name="seleccionPedidos" value="1" /><div className="max-h-80 overflow-auto">{[...pedidos, ...disponibles].map(p => <label key={p.id} className="flex min-h-11 items-center gap-3 py-2 text-sm"><input type="checkbox" name="pedidos" value={p.id} defaultChecked={ruta.pedidos.includes(p.id)} />{p.numeroPedido} · {p.nombreClienteSnapshot}</label>)}</div></RutaMultipleForm></details>
        <details><summary className="min-h-11 cursor-pointer py-2 font-semibold">Asignar repartidores</summary><RutaMultipleForm key={`asignar-${ruta.id}-${ruta.version}`} comando={comando("asignar")} etiqueta="Guardar repartidores"><input type="hidden" name="seleccionRepartidores" value="1" />{modelo.repartidores.map(r => <label key={r.usuario_id} className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" name="repartidores" value={r.usuario_id} defaultChecked={ruta.repartidores.includes(r.usuario_id)} />{r.nombre}</label>)}</RutaMultipleForm></details>
      </div>}
      {ruta.estado === "planificacion" && <RutaMultipleForm comando={comando("preparar")} etiqueta="Iniciar preparación de esta ruta" disabled={!permiso.permitida} />}
      {ruta.estado === "en_reparto" && <p className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">Salida registrada. Asigna los pedidos nuevos a otra ruta independiente desde «Crear ruta».</p>}
      {ruta.estado === "cerrada" && <p className="text-sm text-muted-foreground">Ruta cerrada: sus pedidos y operaciones están bloqueados. Usa «Crear ruta» para una nueva salida.</p>}
      {!!ruta.historial.length && <details><summary className="min-h-11 cursor-pointer py-2 font-semibold">Historial de operaciones de esta ruta</summary><ol className="space-y-3 text-sm">{ruta.historial.map(e => <li key={e.clave} className="break-words rounded-lg border p-3"><p>{new Date(e.instante).toLocaleString("es-CL", { timeZone: "America/Santiago" })} · {describirAccionRuta(e.accion)} · {e.resultado.ok ? "Confirmada" : "Sin confirmar"}</p><p>Responsable: {nombreResponsable(e.actor)} · Versión: {e.resultado.version}</p>{e.pedido && <p>Pedido: {porId.get(e.pedido)?.numeroPedido ?? e.pedido}</p>}{e.resultado.modalidad && <p>{e.resultado.modalidad.replaceAll("_", " ")} · Pedidos incorporados: {e.resultado.pedidos_agregados?.map(id => porId.get(id)?.numeroPedido ?? id).join(", ")}</p>}{e.motivo && <p>Motivo: {e.motivo}</p>}</li>)}</ol></details>}
    </section>}
    <JornadaModos key={ruta?.id ?? fecha} titulo={ruta?.nombre ?? "Pedidos del día"} mensaje={ruta ? permiso.mensaje : "Abre una ruta para preparar sus pedidos. Los pedidos nuevos quedan disponibles hasta asignarlos."} preparacion={<>
      {!pedidos.length && <p className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">No hay pedidos en esta selección. Asigna pedidos disponibles o consulta otra fecha.</p>}<ul className="space-y-2">{pedidos.map((p, n) => <DeliveryOrderCard key={p.id} pedido={p} resumenContable={<RutasContabilidadPedido resumen={contabilidad?.[p.id]} />} operativa numeroPreparacion={n + 1} rutaMultiple soloLecturaRuta={!ruta || ruta.estado !== "preparacion"} />)}</ul>
      {ruta?.estado === "preparacion" && <RutaPreparacionControl key={`${ruta.id}-${ruta.version}-${pedidos.map(p => p.versionPreparacion).join("-")}`} ruta={ruta} pedidos={pedidos} habilitada={permiso.permitida} />}
    </>} salida={ruta ? <section className="space-y-3 rounded-xl border bg-card p-4" aria-label="Despacho y cierre">      {ruta.estado === "preparacion" && <><p className="text-sm">Despacho efectivo: registra la salida de esta ruta. Guarda las cantidades cargadas y confirma el resumen en «Productos de la ruta preparados». Los pedidos resueltos expresamente sin stock quedan fuera de esta ruta.</p>{bloqueosSalida.length > 0 && <ul className="list-disc space-y-1 pl-5 text-sm text-amber-800 dark:text-amber-200">{bloqueosSalida.map(m => <li key={m}>{m}</li>)}</ul>}{!pedidos.length && <p className="text-sm">Selecciona al menos un pedido con productos para despachar.</p>}{!ruta.repartidores.length && <p className="text-sm">Asigna al menos un repartidor habilitado antes de salir.</p>}<RutaMultipleForm comando={comando("salir")} etiqueta="Registrar salida efectiva de esta ruta" disabled={!permiso.permitida || !rutaLista || !ruta.repartidores.length} /></>}
      {ruta.estado === "en_reparto" && <RutaMultipleForm comando={comando("cerrar")} etiqueta="Cerrar esta ruta" disabled={!ruta.pedidos.length || ruta.contadores.pendientes > 0}><label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" required />Confirmo el cierre definitivo de esta ruta.</label></RutaMultipleForm>}
{ruta.estado === "planificacion" && <p className="text-sm text-muted-foreground">Activa la preparación de la ruta antes del despacho.</p>}{ruta.estado === "cerrada" && <p className="text-sm font-semibold">Ruta cerrada · Consulta de paradas e historial</p>}</section> : undefined} ruta={ruta ? <RutaDiaMap key={`${ruta.id}-${ruta.version}`} fecha={fecha} rutaId={ruta.id} versionRuta={ruta.version} cerrada={!editable} paradas={pedidos.map((p, n) => ({ id: p.id, numero: n + 1, cliente: p.nombreClienteSnapshot, ubicacion: p.nombreUbicacionSnapshot, pedido: p.numeroPedido, entregado: p.estado === "entregado", fallida: p.estado === "entrega_fallida", ...(coordenadas.get(p.id) ?? { latitude: null, longitude: null }), detalle: <div className="space-y-3 border-t p-3"><details className="group/productos rounded-lg border bg-muted/20 px-3">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 py-3 text-sm font-semibold text-primary"><span><span className="group-open/productos:hidden">Ver productos</span><span className="hidden group-open/productos:inline">Ocultar productos</span> · {p.items.length}</span><span aria-hidden="true" className="transition-transform group-open/productos:rotate-180">⌄</span></summary>
          <ul className="divide-y border-t">{p.items.map(i => <DeliveryProductDetail key={i.id} item={i} contexto={p.contextoEntrega} />)}</ul>
          <DeliveryOrderTotals pedido={p} />
        </details><RutasContabilidadPedido resumen={contabilidad?.[p.id]} /><DeliveryObservation contexto={p.contextoEntrega} /><div className="flex flex-wrap gap-2"><ActionLink href={`/admin/pedidos/${p.id}`} variant="secondary">Ver pedido</ActionLink>{p.clienteId ? <ActionLink href={ROUTES.adminCustomer(p.clienteId)} variant="secondary">Ver cliente</ActionLink> : <span className="self-center text-xs text-muted-foreground">Cliente no disponible</span>}<EntregaVisualDialog motivoBloqueo={disponibilidad[p.id]} habilitada={ruta.estado === "en_reparto" && disponibilidad[p.id] === null} pedidoId={p.id} versionEsperada={p.versionPreparacion} numero={p.numeroPedido} cliente={p.nombreClienteSnapshot} items={p.items} totalReferencia={p.importeOperativoPreparacion ?? p.totalFinal ?? p.total} /><EntregaFallidaDialog habilitada={ruta.estado === "en_reparto" && p.estado === "en_reparto"} pedidoId={p.id} versionEsperada={p.versionPreparacion} numero={p.numeroPedido} cliente={p.nombreClienteSnapshot} ubicacion={p.nombreUbicacionSnapshot} productos={p.items.length} totalReferencia={p.importeOperativoPreparacion ?? p.totalFinal ?? p.total} /></div></div> }))} /> : <p className="rounded-xl border bg-card p-4 text-sm">Abre una ruta para visualizar sus paradas y mapa.</p>} />
  </div>;
}

export default async function AdminRoutesPage(props: Parameters<typeof AdminRoutesContent>[0]) {
  const params = await props.searchParams;
  const contenido = await AdminRoutesContent(props);
  return <RutasNavigation fecha={typeof params.fecha === "string" ? params.fecha : obtenerFechaLocalActual()} ruta={typeof params.ruta === "string" ? params.ruta : ""}>{contenido}</RutasNavigation>;
}
