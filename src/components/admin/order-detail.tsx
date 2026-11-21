import { bloqueJornada, cuadriculaDetalleJornada, encabezadoProductoJornada, importeJornada, presentacionProductoJornada, tonoJornada } from "@/components/admin/jornada-colores";
import { obtenerUltimoFalloEntrega } from "@/lib/admin/intentos-entrega";
import { DeliveryResult, DeliveryResultDetails, esResultadoEntrega, presentarResultadoEntrega, productoSolicitado } from "@/components/admin/delivery-result";
import { obtenerResultadosEntrega } from "@/lib/admin/resultado-entrega";
import { RecycleOrderLink } from "@/components/admin/recycle-order-link";
import { AdminChat } from "@/components/admin/messages/admin-chat";
import { obtenerDetalleChatAdmin } from "@/lib/admin/mensajes";
import { AdminCustomerDetail } from "@/components/admin/customer-detail";
import { OrderCustomerLink, OrderCustomerViews } from "@/components/admin/order-customer-navigation";
import { UndeliveredOrderActions } from "@/components/admin/undelivered-order-actions";
import { AdministrativeCorrection } from "@/components/admin/administrative-correction";
import { notFound } from "next/navigation";

import { OrderAcceptAction } from "@/components/admin/order-accept-action";
import { OrderCancelAction } from "@/components/admin/order-cancel-action";
import { DeliveryContactActions } from "@/components/admin/delivery-contact-actions";
import { OrderOperationalAction } from "@/components/admin/order-operational-action";
import { OrderStatusBadge } from "@/components/admin/order-status-badge";
import { CatalogImage } from "@/components/media/catalog-image";
import { OrderIdentity } from "@/components/admin/order-identity";
import { ActionLink } from "@/components/ui/action-link";
import { ROUTES } from "@/config/routes";
import { formatearCantidadPedido, obtenerEtiquetaCanalPedido, obtenerPedidoAdmin } from "@/lib/admin/pedidos";
import { formatFechaEntregaLarga } from "@/lib/delivery-date";
import { formatCLP, formatDateTimeCL } from "@/lib/formatters";
import { getGoogleMapsLocationUrl } from "@/lib/maps";
import { formatearMetodosPagoPrevistos } from "@/lib/payment-intent";
import { obtenerIdentidadActual } from "@/lib/account/identity";
import { obtenerPermisoTemporalPreparacion } from "@/lib/order-preparation";
import { DeliveryObservation } from "@/components/admin/delivery-observation";
import { obtenerHistorialPedido } from "@/lib/admin/pedido-historial";
import { obtenerContextoEntrega } from "@/lib/admin/entrega-contexto";
import { obtenerResumenContablePedido } from "@/lib/admin/pedido-contabilidad";
import { ExternalLink } from "lucide-react";

export async function AdminOrderDetail({ id, modal = false, vistaRuta = false }: { id: string; modal?: boolean; vistaRuta?: boolean }) {
  const [pedido, identidad] = await Promise.all([obtenerPedidoAdmin(id), obtenerIdentidadActual()]);
  if (!pedido) notFound();
  const [contextoEntrega, contabilidad, historial, resultados, fallo] = await Promise.all([
    obtenerContextoEntrega(id), obtenerResumenContablePedido(id), obtenerHistorialPedido(id),
    obtenerResultadosEntrega(pedido.estado === "entregado" ? [id] : []),
    pedido.estado === "entrega_fallida" ? obtenerUltimoFalloEntrega(id) : null,
  ]);

  const resultado = esResultadoEntrega(pedido.estado) ? presentarResultadoEntrega(pedido.estado, pedido.total, resultados[id],
    pedido.items.map(item => productoSolicitado(item.id, item.nombreProductoSnapshot, item.nombrePresentacionSnapshot, item.unidadSnapshot, item.cantidad, item.totalLinea)),
    contextoEntrega) : null;
  const importeRegistrado = resultado?.definitivo ?? null;
  const cobradoRegistrado = resultado?.resultado?.total_cobrado ?? null;

  const permisoPreparacion = obtenerPermisoTemporalPreparacion(pedido.fechaEntrega);
  const direccion = [pedido.direccionSnapshot, pedido.comunaSnapshot, pedido.regionSnapshot].filter(Boolean).join(", ");
  const mapsUrl = getGoogleMapsLocationUrl(pedido.latitudEntrega, pedido.longitudEntrega);
  const pagoPrevisto = formatearMetodosPagoPrevistos(pedido.metodosPagoPrevistos) ?? "No registrado";
  const telefonoEntrega = pedido.telefonoContactoEntrega ?? pedido.telefonoClienteSnapshot;
  const nombreEmisor = identidad?.rol === "admin" && identidad.nombreMostrado.trim() !== identidad.email ? identidad.nombreMostrado : null;

  const dato = (tono: keyof typeof tonoJornada) => vistaRuta ? `${bloqueJornada} ${tonoJornada[tono]}` : undefined;
  const tarjeta = vistaRuta ? "min-w-0 rounded-xl border border-border bg-card p-3" : "min-w-0 rounded-xl border border-border bg-card p-4 shadow-sm";
  const ficha = vistaRuta ? "mt-2 grid gap-x-3 gap-y-2 text-sm sm:grid-cols-2" : "mt-3 grid gap-3 text-sm sm:grid-cols-2";
  const grupoContable = vistaRuta ? "grid min-w-0 content-start gap-1.5 rounded-lg border border-border bg-muted/25 p-1.5 sm:grid-rows-[1fr_auto]" : "contents";

  const detail = (
    <div className={vistaRuta ? "min-w-0 space-y-3 wrap-anywhere" : "min-w-0 space-y-4 [overflow-wrap:anywhere]"}>
      <header className={vistaRuta ? tarjeta : "flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-start sm:justify-between"}>
        <div className={vistaRuta ? "min-w-0 space-y-1.5" : "min-w-0 space-y-3"}>
          <div className={vistaRuta ? "[&>div]:grid [&>div]:gap-x-4 [&>div]:gap-y-1 [&>div]:space-y-0 [&_h1]:text-2xl [&_h1]:leading-tight [&_p]:leading-snug sm:[&>div]:grid-cols-[minmax(0,1fr)_minmax(0,30%)] sm:[&_h1]:col-span-full sm:[&_h1]:text-3xl sm:[&_p:last-child]:col-start-2 sm:[&_p:last-child]:row-start-2 sm:[&_p:last-child]:self-center sm:[&_p:last-child]:text-right" : "[&_h1]:text-2xl sm:[&_h1]:text-3xl"}><OrderIdentity pedido={pedido} heading="h1" /></div>
          {!resultado && <OrderStatusBadge estado={pedido.estado} />}
          <p className={vistaRuta ? "text-xs leading-5 text-muted-foreground" : "text-sm leading-6 text-muted-foreground"}>Creado el {formatDateTimeCL(pedido.fechaCreacion)} · Canal {obtenerEtiquetaCanalPedido(pedido.canalOrigen)}</p>
        </div>
        {!modal ? <ActionLink href={ROUTES.adminOrders} variant="secondary" className="shrink-0">Volver a pedidos</ActionLink> : null}
      </header>
      <div className="flex flex-wrap items-start gap-2">
        {pedido.clienteId ? <OrderCustomerLink href={ROUTES.adminCustomer(pedido.clienteId)} variant="secondary">Ver cliente</OrderCustomerLink> : <span className="text-sm text-muted-foreground">Cliente titular no registrado</span>}
        {pedido.estado === "entregado" ? <RecycleOrderLink pedidoId={pedido.id} /> : null}
        {pedido.estado === "recibido" ? <OrderAcceptAction pedidoId={pedido.id} /> : null}
        {pedido.estado === "confirmado" ? pedido.fechaEntrega ? <ActionLink href={`/admin/rutas?fecha=${pedido.fechaEntrega}`}>Ir a ruta</ActionLink> : <span className="text-sm text-muted-foreground">Sin fecha de entrega para ir a ruta</span> : null}
        {["preparando", "listo_despacho", "en_reparto"].includes(pedido.estado) ? <OrderOperationalAction pedidoId={pedido.id} estado={pedido.estado} preparacionEstado={pedido.preparacionEstado} preparacionPermitida={permisoPreparacion.permitida} /> : null}
        {["recibido", "en_revision", "confirmado", "programado", "preparando"].includes(pedido.estado) ? <OrderCancelAction pedidoId={pedido.id} /> : null}
      </div>

      {pedido.estado === "entrega_fallida" ? <UndeliveredOrderActions pedidoId={pedido.id} /> : null}
      {pedido.estado === "cancelado" ? <p className="text-sm text-muted-foreground">Pedido cancelado. Consulta el historial para revisar el motivo y el tratamiento de pagos y créditos; la cancelación no realiza devoluciones automáticas.</p> : null}

      {resultado && <DeliveryResult vistaRuta={vistaRuta} tipo={resultado.tipo}>
        <DeliveryResultDetails vistaRuta={vistaRuta} datos={resultado} contexto={contextoEntrega} fallo={fallo} ocultarOriginal />
      </DeliveryResult>}
      <section className={vistaRuta ? tarjeta : "rounded-xl border border-border bg-card p-4 shadow-sm"} aria-labelledby="resumen-contable-title">
        <h2 id="resumen-contable-title" className="text-sm font-semibold">Resumen contable de la entrega</h2>
        <div className={vistaRuta ? "mt-2 grid gap-2 text-xs tabular-nums [&_dd]:mt-0.5 [&_dd]:text-sm [&_dd]:font-semibold sm:grid-cols-2" : "mt-3 grid gap-3 text-sm sm:grid-cols-2"}>
          <dl className={vistaRuta ? "sm:col-span-2" : "contents"}>
            <div className={dato(contabilidad?.importe_definitivo != null || importeRegistrado != null ? "venta" : "informativo")}><dt className={vistaRuta ? undefined : "text-muted-foreground"}>{contabilidad?.importe_definitivo == null && importeRegistrado != null ? "Importe definitivo registrado" : "Importe definitivo vigente"}</dt><dd>{contabilidad?.importe_definitivo != null ? formatCLP(contabilidad.importe_definitivo) : importeRegistrado != null ? formatCLP(importeRegistrado) : "No registrado"}</dd></div>
          </dl>
          <dl className={grupoContable}>
            <div className={dato(contabilidad?.cobros_entrega?.length ? "completado" : "informativo")}><dt className={vistaRuta ? undefined : "text-muted-foreground"}>Cobros confirmados registrados en la entrega</dt><dd>{contabilidad?.cobros_entrega == null ? "No registrado" : contabilidad.cobros_entrega.length ? contabilidad.cobros_entrega.map(c => <p key={c.metodo}>{c.metodo}: {formatCLP(c.monto)}</p>) : "Sin cobros confirmados"}</dd></div>
            <div className={dato(contabilidad?.cobros_entrega != null || cobradoRegistrado != null ? "completado" : "informativo")}><dt className={vistaRuta ? undefined : "text-muted-foreground"}>Total cobrado en la entrega</dt><dd>{contabilidad?.cobros_entrega != null ? formatCLP(contabilidad.cobros_entrega.reduce((total, c) => total + c.monto, 0)) : cobradoRegistrado != null ? formatCLP(cobradoRegistrado) : "No registrado"}</dd></div>
          </dl>
          <dl className={grupoContable}>
            <div className={dato(contabilidad?.aplicaciones.length ? "completado" : "informativo")}><dt className={vistaRuta ? undefined : "text-muted-foreground"}>Pagos confirmados aplicados a este pedido</dt><dd>{contabilidad ? contabilidad.aplicaciones.length ? contabilidad.aplicaciones.map(c => <p key={c.metodo}>{c.metodo}: {formatCLP(c.monto)}</p>) : "Sin aplicaciones confirmadas" : "No disponible"}</dd></div>
            <div className={dato(contabilidad?.total_aplicado != null ? "completado" : "informativo")}><dt className={vistaRuta ? undefined : "text-muted-foreground"}>Total aplicado al pedido</dt><dd>{contabilidad?.total_aplicado != null ? formatCLP(contabilidad.total_aplicado) : "No disponible"}</dd></div>
          </dl>
          <dl className={vistaRuta ? cuadriculaDetalleJornada + " sm:col-span-2" : "contents"}>
            <div className={dato((contabilidad?.saldo_pedido ?? 0) > 0 ? "pendiente" : "informativo")}><dt className={vistaRuta ? undefined : "text-muted-foreground"}>Saldo pendiente de este pedido</dt><dd>{contabilidad?.saldo_pedido != null ? formatCLP(Math.max(0, contabilidad.saldo_pedido)) : "No disponible"}</dd></div>
            {contabilidad?.saldo_pedido != null && contabilidad.saldo_pedido < 0 ? <div className={dato("informativo")}><dt>Saldo a favor en este pedido</dt><dd>{formatCLP(-contabilidad.saldo_pedido)}</dd></div> : null}
            {(contabilidad?.saldo_favor_origen_entrega ?? 0) > 0 ? <div className={dato("informativo")}><dt>Crédito aún disponible de los pagos de esta entrega</dt><dd>{formatCLP(contabilidad!.saldo_favor_origen_entrega!)}</dd></div> : null}
          </dl>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Los cobros de entrega pueden generar crédito. Las aplicaciones incluyen pagos anteriores o posteriores y sólo su parte atribuida a este pedido. El saldo mostrado no es la deuda acumulada del cliente.</p>
        {contabilidad?.regimen === "legado" ? <p className="mt-2 text-sm text-muted-foreground">Pedido histórico: el saldo sigue el régimen contable legado; no se reconstruye una venta definitiva sin snapshot.</p> : null}
        {!contabilidad ? <p className="mt-2 text-sm text-muted-foreground">Resumen no disponible: requiere instalar el SQL manual de resumen contable.</p> : null}
      </section>
      {!resultado && <DeliveryObservation contexto={contextoEntrega} />}
      {pedido.estado === "entregado" ? <AdministrativeCorrection tipo="venta" id={pedido.id} vistaRuta={vistaRuta} /> : null}

      <p className="text-sm text-muted-foreground">{permisoPreparacion.mensaje}</p>
      {pedido.estado === "preparando" && pedido.fechaEntrega ? <ActionLink href={`/admin/pedidos/entregas/${pedido.fechaEntrega}`} variant="secondary">Ver preparación en la jornada</ActionLink> : null}

      <div className={vistaRuta ? "grid min-w-0 items-start gap-3 md:grid-cols-2" : "grid min-w-0 items-start gap-4 lg:grid-cols-2"}>
        <section className={tarjeta}>
          <h2 className="text-sm font-semibold tracking-tight text-foreground">Cliente titular</h2>
          <dl className={ficha}>
            <div><dt className="text-muted-foreground">Nombre</dt><dd className="mt-1 font-medium text-foreground">{pedido.nombreClienteSnapshot}</dd></div>
            {pedido.telefonoClienteSnapshot ? <div><dt className="text-muted-foreground">Teléfono</dt><dd className="mt-1 text-foreground">{pedido.telefonoClienteSnapshot}</dd></div> : null}
            {pedido.emailClienteSnapshot ? <div><dt className="text-muted-foreground">Email</dt><dd className="mt-1 break-words text-foreground">{pedido.emailClienteSnapshot}</dd></div> : null}
          </dl>
          {pedido.clienteId ? <OrderCustomerLink href={`${ROUTES.adminCustomer(pedido.clienteId)}#cuenta-corriente-title`} variant="quiet" className="mt-3">Consultar cuenta corriente</OrderCustomerLink> : <p className="mt-3 text-sm text-muted-foreground">Sin cliente asociado para consultar cuenta corriente.</p>}
        </section>

        <section className={tarjeta}>
          <h2 className="text-sm font-semibold tracking-tight text-foreground">Entrega</h2>
          <dl className={ficha}>
            <div><dt className="text-muted-foreground">Fecha de entrega</dt><dd className="mt-1 font-medium text-foreground">{pedido.fechaEntrega ? formatFechaEntregaLarga(pedido.fechaEntrega) : "Sin fecha registrada"}</dd></div>
            {pedido.destinatarioEntrega ? <div><dt className="text-muted-foreground">Destinatario</dt><dd className="mt-1 font-medium text-foreground">{pedido.destinatarioEntrega}</dd></div> : null}
            {telefonoEntrega ? <div><dt className="text-muted-foreground">Teléfono</dt><dd className="mt-1"><DeliveryContactActions telefono={telefonoEntrega} numeroPedido={pedido.numeroPedido} estado={pedido.estado} nombreEmisor={nombreEmisor} /></dd></div> : null}
            <div className="sm:col-span-2"><dt className="text-muted-foreground">Dirección de entrega</dt><dd className="mt-1 leading-6 text-foreground">{direccion || "No registrada"}</dd></div>
            {pedido.zonaEntrega ? <div><dt className="text-muted-foreground">Zona</dt><dd className="mt-1 text-foreground">{pedido.zonaEntrega}</dd></div> : null}
            {pedido.referenciaDireccionSnapshot ? <div className="sm:col-span-2"><dt className="text-muted-foreground">Referencia</dt><dd className="mt-1 leading-6 text-muted-foreground">{pedido.referenciaDireccionSnapshot}</dd></div> : null}
          </dl>
          {mapsUrl ? <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-semibold text-primary underline underline-offset-4"><ExternalLink className="size-4" aria-hidden="true" />Ver ubicación</a> : null}
        </section>

      </div>
      <div className={vistaRuta ? "grid min-w-0 items-start gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,19rem)]" : "grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]"}>
        <section className={tarjeta}>
          <h2 className="text-sm font-semibold tracking-tight text-foreground">Productos</h2>
          {pedido.items.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">No hay productos registrados.</p> : null}
          <ul className="mt-3 divide-y divide-border">
            {pedido.items.map((item) => <li key={item.id} className={vistaRuta ? "grid min-w-0 items-start gap-2 py-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]" : "grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-2 py-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center"}>
              <div className={vistaRuta ? "flex min-w-0 items-center gap-2" : "col-span-2 flex min-w-0 items-center gap-3 sm:col-span-1"}>
                <div className="relative size-10 shrink-0 overflow-hidden rounded-lg bg-muted">
                  <CatalogImage image={item.rutaImagen ? { src: item.rutaImagen, alt: "", fit: "contain" } : undefined} fallback="package" sizes="40px" fallbackIconClassName="size-6" />
                </div>
                <div className={vistaRuta ? encabezadoProductoJornada : "min-w-0"}><h3 className={vistaRuta ? "text-sm font-semibold" : "font-medium text-foreground"}>{item.nombreProductoSnapshot}</h3><p className={vistaRuta ? presentacionProductoJornada : "mt-1 text-sm text-muted-foreground"}>{item.nombrePresentacionSnapshot ?? "Presentación no registrada"}</p></div>
              </div>
              <div className={vistaRuta ? cuadriculaDetalleJornada : "contents"}>
                <dl className={vistaRuta ? "contents" : "grid grid-cols-2 gap-3 text-xs"}>
                  <div className={dato("planificado")}><dt className={vistaRuta ? undefined : "text-muted-foreground"}>Cantidad</dt><dd className={vistaRuta ? "font-semibold" : "mt-1 font-medium text-foreground"}>{formatearCantidadPedido(item.cantidad, item.unidadSnapshot)}</dd></div>
                  <div className={dato("informativo")}><dt className={vistaRuta ? undefined : "text-muted-foreground"}>Precio unitario (snapshot)</dt><dd className={vistaRuta ? "font-semibold" : "mt-1 font-medium text-foreground"}>{formatCLP(item.precioFinalUnitarioSnapshot)}</dd></div>
                </dl>
                <div className={vistaRuta ? dato("informativo") : "text-right text-sm"}><p className={vistaRuta ? undefined : "text-xs text-muted-foreground"}>Subtotal</p><p className={vistaRuta ? "font-semibold" : "mt-1 font-semibold tabular-nums text-foreground"}>{formatCLP(item.totalLinea)}</p></div>
              </div>
            </li>)}
          </ul>
        </section>

        <section className={tarjeta}>
          <h2 className="text-sm font-semibold tracking-tight text-foreground">Totales y pago previsto</h2>
          <dl className="mt-3 grid gap-2 text-sm">
            {pedido.preparacionEstado ? <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Preparación</dt><dd className="font-medium text-foreground">{pedido.preparacionEstado === "incompleta" ? "Incompleta" : pedido.preparacionEstado === "completa" ? "Completa" : "Pendiente"}</dd></div> : null}
            <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Subtotal</dt><dd>{formatCLP(pedido.subtotal)}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Costo entrega</dt><dd>{formatCLP(pedido.costoEntrega)}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Descuento</dt><dd>{formatCLP(pedido.descuento)}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Pago previsto</dt><dd className="text-right font-medium text-foreground">{pagoPrevisto}</dd></div>
            <div className="flex justify-between gap-3 border-t border-border pt-2 font-semibold text-foreground"><dt className="text-muted-foreground">Total original</dt><dd>{formatCLP(pedido.total)}</dd></div>
            {pedido.subtotalFinal !== null ? <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Subtotal final</dt><dd>{formatCLP(pedido.subtotalFinal)}</dd></div> : null}
            {pedido.totalFinal !== null && pedido.totalFinal !== (contabilidad?.importe_definitivo ?? importeRegistrado) ? <div className="flex justify-between gap-3 text-base font-semibold text-foreground"><dt>Total final</dt><dd className={vistaRuta ? `${importeJornada} ${tonoJornada.venta} text-right` : undefined}>{formatCLP(pedido.totalFinal)}</dd></div> : null}
          </dl>
          <p className="mt-3 text-sm text-muted-foreground">Los métodos de pago previstos no acreditan pagos.</p>
        </section>

      </div>
      <section className={tarjeta} aria-labelledby="historial-precios-title">
        {historial?.eventos.length ? <a href={`/admin/pedidos/detalle/${pedido.id}/historial`} className="inline-flex min-h-11 items-center text-sm font-semibold text-primary underline underline-offset-4">Ver historial de auditoría del pedido</a> : <p className="inline-flex min-h-11 items-center text-sm text-muted-foreground">Sin registros de auditoría</p>}
        {historial?.avisos.length ? <p className="mb-2 text-sm text-muted-foreground">Algunas fuentes de auditoría no están disponibles.</p> : null}
        <h2 id="historial-precios-title" className="text-sm font-semibold tracking-tight text-foreground">Historial de ajustes de precios administrativos</h2>
        <p className="mt-2 text-sm text-muted-foreground">Ajustes registrados al crear el pedido administrativo.</p>
        {pedido.historialPrecios === null ? <p className="mt-3 text-sm text-muted-foreground">El historial de ajustes administrativos todavía no está disponible en este entorno.</p> : pedido.historialPrecios.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">Sin ajustes de precios administrativos registrados para este pedido. Los pedidos históricos, web o convertidos pueden no tener registros en esta auditoría.</p> : (
          <ul className="mt-3 divide-y divide-border">
            {pedido.historialPrecios.map((ajuste) => {
              const item = pedido.items.find((producto) => producto.id === ajuste.itemPedidoId);
              return <li key={ajuste.itemPedidoId} className={vistaRuta ? "space-y-2 py-2" : "space-y-2 py-3"}>
                <h3 className={vistaRuta ? `${item ? encabezadoProductoJornada : dato("informativo")} text-sm font-semibold` : "font-medium text-foreground"}>{item ? [item.nombreProductoSnapshot, item.nombrePresentacionSnapshot].filter(Boolean).join(" · ") : "Producto no disponible"}</h3>
                <dl className={vistaRuta ? "grid gap-1.5 text-xs tabular-nums sm:grid-cols-2" : "grid gap-3 text-sm sm:grid-cols-2"}>
                  <div className={dato("informativo")}><dt className={vistaRuta ? undefined : "text-muted-foreground"}>{ajuste.totalOriginal === null ? "Precio de referencia unitario" : "Total original de línea"}</dt><dd className={vistaRuta ? "mt-0.5 text-sm font-semibold" : "mt-1"}>{formatCLP(ajuste.totalOriginal ?? ajuste.precioReferencia)}</dd></div>
                  <div className={dato(ajuste.totalAplicado != null || ajuste.precioAplicado != null ? "venta" : "informativo")}><dt className={vistaRuta ? undefined : "text-muted-foreground"}>{ajuste.totalAplicado === null ? "Precio aplicado unitario" : "Total final de línea"}</dt><dd className={vistaRuta ? "mt-0.5 text-sm font-semibold" : "mt-1"}>{formatCLP(ajuste.totalAplicado ?? ajuste.precioAplicado ?? 0)}</dd></div>
                  <div className="sm:col-span-2"><dt className="text-muted-foreground">Motivo</dt><dd className="mt-1 whitespace-pre-wrap break-words">{ajuste.motivo}</dd></div>
                  <div><dt className="text-muted-foreground">Actor (ID administrador)</dt><dd className="mt-1 break-all">{ajuste.administradorId}</dd></div>
                  <div><dt className="text-muted-foreground">Fecha de autorización</dt><dd className="mt-1"><time dateTime={ajuste.fechaAutorizacion}>{formatDateTimeCL(ajuste.fechaAutorizacion)}</time></dd></div>
                </dl>
              </li>;
            })}
          </ul>
        )}
      </section>

      {pedido.observacionGeneral ? <section className={tarjeta}><h2 className="text-sm font-semibold tracking-tight text-foreground">Observación</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{pedido.observacionGeneral}</p></section> : null}
    </div>
  );

  if (!modal || !pedido.clienteId) return detail;
  const chat = await obtenerDetalleChatAdmin(pedido.clienteId);
  return <OrderCustomerViews customer={<AdminCustomerDetail id={pedido.clienteId} readOnly />} messages={chat ? <AdminChat embedded cliente={chat.cliente} conversacionInicial={chat.conversacion} mensajesIniciales={chat.mensajes} tieneMensajesAnterioresInicial={chat.tieneMensajesAnteriores} /> : <p role="status">No fue posible cargar la conversación.</p>}>{detail}</OrderCustomerViews>;
}
