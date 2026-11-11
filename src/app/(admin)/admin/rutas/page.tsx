import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { exigirAdminReparto } from "@/lib/reparto/server";
import { obtenerDetalleEntregaAdmin, obtenerFechaLocalActual, obtenerCoordenadasRuta, obtenerConteoPedidosPorFecha } from "@/lib/admin/pedidos";
import { obtenerPermisoTemporalPreparacion } from "@/lib/order-preparation";
import { formatFechaEntregaCorta, formatFechaEntregaLarga } from "@/lib/delivery-date";
import { PageHeader } from "@/components/shared/page-header";
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
export default async function AdminRoutesPage({ searchParams }: { searchParams: Promise<{ fecha?: string | string[]; ruta?: string | string[] }> }) {
  const params = await searchParams;
  const hoy = obtenerFechaLocalActual();
  const fecha = params.fecha ?? hoy;
  if (typeof fecha !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !Number.isFinite(Date.parse(`${fecha}T12:00:00Z`)) || new Date(`${fecha}T12:00:00Z`).toISOString().slice(0, 10) !== fecha || fecha.startsWith("0000")) notFound();
  const db = await exigirAdminReparto();
  const { data, error } = await db.rpc("leer_rutas_multiples", { p_fecha: fecha });
  if (error || data?.contrato !== 3 || !Array.isArray(data.rutas) || !Array.isArray(data.repartidores)) {
    const consulta = await obtenerDetalleEntregaAdmin(fecha);
    return <div className="space-y-4"><PageHeader title="Rutas" description="Preparación y reparto · Hidro Leufú" /><p role="alert" className="rounded-xl border bg-card p-4">Rutas múltiples no disponibles. Falta instalar el SQL manual de Fase 3 o no se pudo verificar el contrato. La operación de rutas permanece bloqueada hasta verificar la instalación.</p><form action="/admin/rutas" className="flex flex-wrap gap-3"><label>Fecha<input type="date" name="fecha" required defaultValue={fecha} className="ml-2 min-h-11 rounded-lg border bg-background p-2" /></label><button className="min-h-11 rounded-lg border px-3">Consultar</button></form><h2 className="font-semibold">{formatFechaEntregaLarga(fecha)} · {consulta.pedidos.length} pedidos</h2><ul className="space-y-3">{consulta.pedidos.map((p, n) => <DeliveryOrderCard key={p.id} pedido={p} operativa numeroPreparacion={n + 1} rutaMultiple soloLecturaRuta />)}</ul><ActionLink href="/admin/pedidos" variant="secondary">Ver pedidos</ActionLink></div>;
  }
  const modelo = data as RutasMultiples;
  if (modelo.legado) return <><p className="mb-4 rounded-xl border bg-card p-4 text-sm">Esta fecha conserva una jornada del sistema anterior. Se mantiene su historial y su operación original; las rutas múltiples se habilitan en fechas sin carga previa.</p><LegacyRoutesPage searchParams={Promise.resolve({ fecha })} /></>;
  if (params.ruta !== undefined && typeof params.ruta !== "string") notFound();
  const ruta = modelo.rutas.find(r => r.id === params.ruta);
  if (params.ruta && !ruta) notFound();
  const entrega = await obtenerDetalleEntregaAdmin(fecha);
  const dias = Array.from({ length: 7 }, (_, n) => { const d = new Date(`${hoy}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); });
  const conteo = await obtenerConteoPedidosPorFecha(hoy, dias[6]);
  const asignados = new Set(modelo.rutas.flatMap(r => r.pedidos));
  const disponibles = entrega.pedidos.filter(p => !asignados.has(p.id) && ["recibido", "en_revision", "programado", "confirmado", "preparando", "listo_despacho"].includes(p.estado));
  const porId = new Map(entrega.pedidos.map(p => [p.id, p]));
  const pedidos = ruta ? ruta.pedidos.flatMap(id => { const p = porId.get(id); return p ? [p] : []; }) : entrega.pedidos;
  const editable = !!ruta && ["planificacion", "preparacion"].includes(ruta.estado);
  const permiso = obtenerPermisoTemporalPreparacion(fecha);
  const [coordenadas, disponibilidad] = await Promise.all([obtenerCoordenadasRuta(pedidos.map(p => p.id)), leerDisponibilidadEntrega(pedidos.map(p => p.id))]);
  const comando = (accion: SolicitudRutaMultiple["accion"]) => ({ accion, ruta: ruta!.id, fecha, version: ruta!.version });
  return <div className="space-y-6">
    <PageHeader title="Rutas" description="Preparación y reparto · Hidro Leufú" actions={<ActionLink href="/admin/pedidos" variant="secondary">Ver pedidos</ActionLink>} />
    <section className="space-y-4 rounded-xl border bg-card p-4">
      <nav className="flex gap-2 overflow-x-auto pb-2" aria-label="Próximos siete días">{dias.map(d => <Link key={d} prefetch={false} href={`/admin/rutas?fecha=${d}`} aria-current={d === fecha ? "date" : undefined} className={`min-w-28 flex-1 rounded-lg border p-3 text-center text-sm ${d === fecha ? "border-primary bg-primary/10 text-primary" : "border-border"}`}><span className="block font-semibold">{d === hoy ? "Hoy" : formatFechaEntregaCorta(d)}</span><span>{conteo[d] ?? 0} pedidos</span></Link>)}</nav>
      <form action="/admin/rutas" className="flex flex-wrap items-end gap-3"><label className="text-sm">Consultar fecha<input name="fecha" type="date" required defaultValue={fecha} className="mt-1 block min-h-11 rounded-lg border bg-background px-3" /></label><button className="min-h-11 rounded-lg border px-4">Consultar</button></form>
      <h2 className="font-semibold">{formatFechaEntregaLarga(fecha)}</h2>
      <p className="text-sm">{entrega.pedidos.length} pedidos del día · {disponibles.length} disponibles para asignación</p>
      <details><summary className="min-h-11 cursor-pointer py-3 font-semibold">Crear ruta</summary><RutaMultipleForm key={`crear-${modelo.rutas.length}`} comando={{ accion: "crear", ruta: "", fecha, version: 0 }} etiqueta="Crear ruta"><label className="block text-sm">Nombre o número de ruta<input name="nombre" required maxLength={100} placeholder="Ruta 1 · Centro" className="mt-1 min-h-11 w-full rounded-lg border bg-background p-2" /></label></RutaMultipleForm></details>
    </section>
    <nav className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="Rutas creadas">
      <Link href={`/admin/rutas?fecha=${fecha}`} className="rounded-xl border bg-card p-4 font-semibold">Todos los pedidos del día ({entrega.pedidos.length})</Link>
      {modelo.rutas.map(r => <Link key={r.id} href={`/admin/rutas?fecha=${fecha}&ruta=${r.id}`} aria-current={r.id === ruta?.id ? "page" : undefined} className={`space-y-2 rounded-xl border bg-card p-4 ${r.id === ruta?.id ? "border-primary ring-1 ring-primary" : ""}`}><span className="block font-semibold">{r.nombre} · {r.estado.replaceAll("_", " ")}</span><span className="block text-xs">{r.pedidos.length} pedidos · Preparación · Sin preparar: {r.contadores.sin_preparar} · Parcial: {r.contadores.parciales} · Listo: {r.contadores.preparados} · Pendientes de entrega: {r.contadores.pendientes_entrega} · En reparto: {r.contadores.en_reparto} · Entregados: {r.contadores.entregados} · No entregados: {r.contadores.no_entregados} · Sin resolver: {r.contadores.pendientes}</span></Link>)}
    </nav>
    {ruta && <section className="space-y-4 rounded-xl border bg-card p-4">
      <h2 className="text-lg font-semibold">{ruta.nombre}</h2>
      <p className="text-sm">Repartidores: {ruta.repartidores.map(id => modelo.repartidores.find(r => r.usuario_id === id)?.nombre ?? "Repartidor no habilitado").join(", ") || "Sin asignar"}</p>
      {editable && <div className="grid gap-5 lg:grid-cols-2">
        <details><summary className="min-h-11 cursor-pointer py-2 font-semibold">Seleccionar pedidos</summary><RutaMultipleForm key={`seleccion-${ruta.id}-${ruta.version}`} comando={comando("seleccionar")} etiqueta="Guardar selección"><input type="hidden" name="seleccionPedidos" value="1" /><div className="max-h-80 overflow-auto">{[...pedidos, ...disponibles].map(p => <label key={p.id} className="flex min-h-11 items-center gap-3 py-2 text-sm"><input type="checkbox" name="pedidos" value={p.id} defaultChecked={ruta.pedidos.includes(p.id)} />{p.numeroPedido} · {p.nombreClienteSnapshot}</label>)}</div></RutaMultipleForm></details>
        <details><summary className="min-h-11 cursor-pointer py-2 font-semibold">Asignar repartidores</summary><RutaMultipleForm key={`asignar-${ruta.id}-${ruta.version}`} comando={comando("asignar")} etiqueta="Guardar repartidores"><input type="hidden" name="seleccionRepartidores" value="1" />{modelo.repartidores.map(r => <label key={r.usuario_id} className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" name="repartidores" value={r.usuario_id} defaultChecked={ruta.repartidores.includes(r.usuario_id)} />{r.nombre}</label>)}</RutaMultipleForm></details>
      </div>}
      {ruta.estado === "planificacion" && <RutaMultipleForm comando={comando("preparar")} etiqueta="Iniciar preparación de esta ruta" disabled={!permiso.permitida} />}
      {ruta.estado === "preparacion" && <><p className="text-sm">Confirma productos e importes y finaliza cada pedido. Los parciales requieren autorización expresa con las cantidades actuales.</p><RutaMultipleForm comando={comando("salir")} etiqueta="Autorizar salida de esta ruta" disabled={!permiso.permitida}><label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" required />Confirmo la salida con las cantidades e importes registrados.</label></RutaMultipleForm></>}
      {ruta.estado === "en_reparto" && <RutaMultipleForm comando={comando("cerrar")} etiqueta="Cerrar esta ruta" disabled={!ruta.pedidos.length || ruta.contadores.pendientes > 0}><label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" required />Confirmo el cierre definitivo de esta ruta.</label></RutaMultipleForm>}
      {ruta.estado === "en_reparto" && <details className="rounded-lg border p-3"><summary className="min-h-11 cursor-pointer py-2 font-semibold">{ruta.contadores.entregados + ruta.contadores.no_entregados > 0 ? "Incorporación extraordinaria" : "Modificar ruta despachada · Agregar pedidos"}</summary>
        <p className="mb-3 text-sm">Agrega pedidos sin retirar ni modificar los existentes. Deben estar completamente preparados y finalizados, con fecha de hoy. Prepara los pedidos nuevos desde administración antes de incorporarlos. Para otros cambios, crea otra ruta.</p>
        <RutaMultipleForm key={`incorporar-${ruta.id}-${ruta.version}`} comando={comando("incorporar")} etiqueta="Autorizar incorporación y despacho" disabled={!permiso.permitida || !disponibles.some(p => p.estado === "listo_despacho")}>
          <input type="hidden" name="seleccionPedidos" value="1" />
          <div className="max-h-80 overflow-auto">{disponibles.filter(p => p.estado === "listo_despacho").map(p => <label key={p.id} className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" name="pedidos" value={p.id} />{p.numeroPedido} · {p.nombreClienteSnapshot}</label>)}</div>
          <label className="block text-sm">Motivo obligatorio<textarea name="motivo" required maxLength={2000} className="mt-1 w-full rounded-lg border bg-background p-2" /></label>
          <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" required />Autorizo expresamente incorporar y despachar estos pedidos conservando las operaciones anteriores.</label>
        </RutaMultipleForm>
      </details>}
      {ruta.estado === "cerrada" && <p className="text-sm text-muted-foreground">Ruta cerrada: sus pedidos y operaciones están bloqueados. Usa «Crear ruta» para una nueva salida.</p>}
      {!!ruta.historial.length && <details><summary className="min-h-11 cursor-pointer py-2 font-semibold">Historial de operaciones de esta ruta</summary><ol className="space-y-3 text-sm">{ruta.historial.map(e => <li key={e.clave} className="break-words rounded-lg border p-3"><p>{new Date(e.instante).toLocaleString("es-CL", { timeZone: "America/Santiago" })} · {e.accion.replaceAll("_", " ")} · {e.resultado.ok ? "Confirmada" : "Sin confirmar"}</p><p>Responsable: {e.actor} · Versión: {e.resultado.version}</p>{e.pedido && <p>Pedido: {porId.get(e.pedido)?.numeroPedido ?? e.pedido}</p>}{e.resultado.modalidad && <p>{e.resultado.modalidad.replaceAll("_", " ")} · Pedidos incorporados: {e.resultado.pedidos_agregados?.map(id => porId.get(id)?.numeroPedido ?? id).join(", ")}</p>}{e.motivo && <p>Motivo: {e.motivo}</p>}</li>)}</ol></details>}
    </section>}
    <JornadaModos key={ruta?.id ?? fecha} titulo={ruta?.nombre ?? "Pedidos del día"} mensaje={ruta ? permiso.mensaje : "Abre una ruta para preparar sus pedidos. Los pedidos nuevos quedan disponibles hasta asignarlos."} preparacion={<>
      <ul className="space-y-3">{pedidos.map((p, n) => <DeliveryOrderCard key={p.id} pedido={p} operativa numeroPreparacion={n + 1} rutaMultiple soloLecturaRuta={!ruta || ruta.estado !== "preparacion"} />)}</ul>
      {ruta?.estado === "preparacion" && pedidos.filter(p => p.items.some(i => (i.cantidadPreparada ?? 0) > 0) && p.items.some(i => (i.cantidadPreparada ?? 0) < i.cantidad)).map(p => {
        const a = ruta.autorizaciones.find(a => a.pedido === p.id && a.version === p.versionPreparacion && a.cantidades.length === p.items.length && p.items.every(i => a.cantidades.some(c => c.item === i.id && c.solicitada === i.cantidad && c.preparada === (i.cantidadPreparada ?? 0))));
        return <details key={`${p.id}-${p.versionPreparacion}-${ruta.version}`} className="rounded-xl border bg-card p-4"><summary className="min-h-11 cursor-pointer py-2 font-semibold">Salida parcial · {p.numeroPedido}{a ? " · Autorizada" : " · Requiere autorización"}</summary>
          <ul className="my-3 text-sm">{p.items.map(i => <li key={i.id}>{i.nombreProducto}: preparado {i.cantidadPreparada ?? 0} / solicitado {i.cantidad} · Diferencia {i.cantidad - (i.cantidadPreparada ?? 0)}</li>)}</ul>
          {a && <p className="text-sm">Motivo registrado: {a.motivo}</p>}
          <RutaMultipleForm comando={{ ...comando("autorizar_parcial"), pedido: p.id, version_pedido: p.versionPreparacion }} etiqueta="Autorizar expresamente este parcial" disabled={!permiso.permitida || p.estado !== "listo_despacho"}><label className="block text-sm">Motivo<textarea name="motivo" required maxLength={2000} className="mt-1 w-full rounded-lg border bg-background p-2" /></label><label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" required />Acepto estas cantidades y diferencias para la salida parcial.</label></RutaMultipleForm>
        </details>;
      })}
      {!ruta && <details className="rounded-xl border bg-card p-4"><summary className="min-h-11 cursor-pointer py-2 font-semibold">Productos solicitados del día</summary><DeliveryProductsSummary productos={entrega.resumenProductos} variant="compact" /></details>}
    </>} ruta={ruta ? <RutaDiaMap key={`${ruta.id}-${ruta.version}`} fecha={fecha} rutaId={ruta.id} versionRuta={ruta.version} cerrada={!editable} paradas={pedidos.map((p, n) => ({ id: p.id, numero: n + 1, cliente: p.nombreClienteSnapshot, ubicacion: p.nombreUbicacionSnapshot, pedido: p.numeroPedido, entregado: p.estado === "entregado", fallida: p.estado === "entrega_fallida", ...(coordenadas.get(p.id) ?? { latitude: null, longitude: null }), detalle: <div className="space-y-3 border-t p-3"><ul className="text-sm">{p.items.map(i => <li key={i.id}>{i.nombreProducto} · Preparado {i.cantidadPreparada ?? 0} / {i.cantidad} {i.unidad}</li>)}</ul><div className="flex flex-wrap gap-2"><ActionLink href={`/admin/pedidos/${p.id}/historial`} variant="secondary">Ver historial</ActionLink><EntregaVisualDialog motivoBloqueo={disponibilidad[p.id]} habilitada={ruta.estado === "en_reparto" && disponibilidad[p.id] === null} pedidoId={p.id} versionEsperada={p.versionPreparacion} numero={p.numeroPedido} cliente={p.nombreClienteSnapshot} items={p.items} totalReferencia={p.importeOperativoPreparacion ?? p.totalFinal ?? p.total} /><EntregaFallidaDialog habilitada={ruta.estado === "en_reparto" && p.estado === "en_reparto"} pedidoId={p.id} versionEsperada={p.versionPreparacion} numero={p.numeroPedido} cliente={p.nombreClienteSnapshot} ubicacion={p.nombreUbicacionSnapshot} productos={p.items.length} totalReferencia={p.importeOperativoPreparacion ?? p.totalFinal ?? p.total} /></div></div> }))} /> : <p className="rounded-xl border bg-card p-4 text-sm">Abre una ruta para visualizar sus paradas y mapa.</p>} />
  </div>;
}
