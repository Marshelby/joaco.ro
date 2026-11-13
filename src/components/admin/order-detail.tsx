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
import { obtenerContextoEntrega } from "@/lib/admin/entrega-contexto";
import { obtenerResumenContablePedido } from "@/lib/admin/pedido-contabilidad";
import { ExternalLink } from "lucide-react";

export async function AdminOrderDetail({ id, modal = false }: { id: string; modal?: boolean }) {
  const [pedido, identidad] = await Promise.all([obtenerPedidoAdmin(id), obtenerIdentidadActual()]);
  if (!pedido) notFound();
  const [contextoEntrega, contabilidad] = await Promise.all([obtenerContextoEntrega(id), obtenerResumenContablePedido(id)]);

  const permisoPreparacion = obtenerPermisoTemporalPreparacion(pedido.fechaEntrega);
  const direccion = [pedido.direccionSnapshot, pedido.comunaSnapshot, pedido.regionSnapshot].filter(Boolean).join(", ");
  const mapsUrl = getGoogleMapsLocationUrl(pedido.latitudEntrega, pedido.longitudEntrega);
  const pagoPrevisto = formatearMetodosPagoPrevistos(pedido.metodosPagoPrevistos) ?? "No registrado";
  const telefonoEntrega = pedido.telefonoContactoEntrega ?? pedido.telefonoClienteSnapshot;
  const nombreEmisor = identidad?.rol === "admin" && identidad.nombreMostrado.trim() !== identidad.email ? identidad.nombreMostrado : null;

  return (
    <div className="min-w-0 space-y-4 [overflow-wrap:anywhere]">
      <header className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-3">
          <div className="[&_h1]:text-2xl sm:[&_h1]:text-3xl"><OrderIdentity pedido={pedido} heading="h1" /></div>
          <OrderStatusBadge estado={pedido.estado} />
          <p className="text-sm leading-6 text-muted-foreground">Creado el {formatDateTimeCL(pedido.fechaCreacion)} · Canal {obtenerEtiquetaCanalPedido(pedido.canalOrigen)}</p>
        </div>
        {!modal ? <ActionLink href={ROUTES.adminOrders} variant="secondary" className="shrink-0">Volver a pedidos</ActionLink> : null}
      </header>
      <div className="flex flex-wrap items-start gap-2">
        {pedido.clienteId ? <ActionLink href={ROUTES.adminCustomer(pedido.clienteId)} variant="secondary">Ver cliente</ActionLink> : <span className="text-sm text-muted-foreground">Cliente titular no registrado</span>}
        {pedido.estado === "recibido" ? <OrderAcceptAction pedidoId={pedido.id} /> : null}
        {["confirmado", "preparando", "listo_despacho", "en_reparto"].includes(pedido.estado) ? <OrderOperationalAction pedidoId={pedido.id} estado={pedido.estado} preparacionEstado={pedido.preparacionEstado} preparacionPermitida={permisoPreparacion.permitida} /> : null}
        {["recibido", "en_revision", "confirmado", "programado", "preparando"].includes(pedido.estado) ? <OrderCancelAction pedidoId={pedido.id} /> : null}
      </div>

      {pedido.estado === "entrega_fallida" ? <UndeliveredOrderActions pedidoId={pedido.id} /> : null}
      {pedido.estado === "cancelado" ? <p className="text-sm text-muted-foreground">Pedido cancelado. Consulta el historial para revisar el motivo y el tratamiento de pagos y créditos; la cancelación no realiza devoluciones automáticas.</p> : null}

      <section className="rounded-xl border border-border bg-card p-4 shadow-sm" aria-labelledby="resumen-contable-title">
        <h2 id="resumen-contable-title" className="text-sm font-semibold">Resumen contable de la entrega</h2>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <div><dt className="text-muted-foreground">Repartidor que confirmó la entrega</dt><dd>{contabilidad?.repartidor ? <>{contabilidad.repartidor.nombre}<span className="block break-all text-xs text-muted-foreground">ID: {contabilidad.repartidor.id}</span></> : "No registrado"}</dd></div>
          <div><dt className="text-muted-foreground">Importe definitivo vigente</dt><dd>{contabilidad?.importe_definitivo != null ? formatCLP(contabilidad.importe_definitivo) : "No registrado"}</dd></div>
          <div><dt className="text-muted-foreground">Cobros confirmados registrados en la entrega</dt><dd>{contabilidad?.cobros_entrega == null ? "No registrado" : contabilidad.cobros_entrega.length ? contabilidad.cobros_entrega.map(c => <p key={c.metodo}>{c.metodo}: {formatCLP(c.monto)}</p>) : "Sin cobros confirmados"}</dd></div>
          <div><dt className="text-muted-foreground">Total cobrado en la entrega</dt><dd>{contabilidad?.cobros_entrega != null ? formatCLP(contabilidad.cobros_entrega.reduce((total, c) => total + c.monto, 0)) : "No registrado"}</dd></div>
          <div><dt className="text-muted-foreground">Pagos confirmados aplicados a este pedido</dt><dd>{contabilidad ? contabilidad.aplicaciones.length ? contabilidad.aplicaciones.map(c => <p key={c.metodo}>{c.metodo}: {formatCLP(c.monto)}</p>) : "Sin aplicaciones confirmadas" : "No disponible"}</dd></div>
          <div><dt className="text-muted-foreground">Total aplicado al pedido</dt><dd>{contabilidad?.total_aplicado != null ? formatCLP(contabilidad.total_aplicado) : "No disponible"}</dd></div>
          <div><dt className="text-muted-foreground">Saldo pendiente de este pedido</dt><dd>{contabilidad?.saldo_pedido != null ? formatCLP(Math.max(0, contabilidad.saldo_pedido)) : "No disponible"}</dd></div>
          {contabilidad?.saldo_pedido != null && contabilidad.saldo_pedido < 0 ? <div><dt>Saldo a favor en este pedido</dt><dd>{formatCLP(-contabilidad.saldo_pedido)}</dd></div> : null}
          {(contabilidad?.saldo_favor_origen_entrega ?? 0) > 0 ? <div><dt>Crédito aún disponible de los pagos de esta entrega</dt><dd>{formatCLP(contabilidad!.saldo_favor_origen_entrega!)}</dd></div> : null}
        </dl>
        <p className="mt-3 text-xs text-muted-foreground">Los cobros de entrega pueden generar crédito. Las aplicaciones incluyen pagos anteriores o posteriores y sólo su parte atribuida a este pedido. El saldo mostrado no es la deuda acumulada del cliente.</p>
        {contabilidad?.regimen === "legado" ? <p className="mt-2 text-sm text-muted-foreground">Pedido histórico: el saldo sigue el régimen contable legado; no se reconstruye una venta definitiva sin snapshot.</p> : null}
        {!contabilidad ? <p className="mt-2 text-sm text-muted-foreground">Resumen no disponible: requiere instalar el SQL manual de resumen contable.</p> : null}
      </section>
      <DeliveryObservation contexto={contextoEntrega} />
      {pedido.estado === "entregado" ? <AdministrativeCorrection tipo="venta" id={pedido.id} /> : null}

      <p className="text-sm text-muted-foreground">{permisoPreparacion.mensaje}</p>
      {pedido.estado === "preparando" && pedido.fechaEntrega ? <ActionLink href={`/admin/pedidos/entregas/${pedido.fechaEntrega}`} variant="secondary">Ver preparación en la jornada</ActionLink> : null}

      <div className="grid min-w-0 items-start gap-4 lg:grid-cols-2">
        <section className="min-w-0 rounded-xl border border-border bg-card p-4 shadow-sm">
          <h2 className="text-sm font-semibold tracking-tight text-foreground">Cliente titular</h2>
          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
            <div><dt className="text-muted-foreground">Nombre</dt><dd className="mt-1 font-medium text-foreground">{pedido.nombreClienteSnapshot}</dd></div>
            {pedido.telefonoClienteSnapshot ? <div><dt className="text-muted-foreground">Teléfono</dt><dd className="mt-1 text-foreground">{pedido.telefonoClienteSnapshot}</dd></div> : null}
            {pedido.emailClienteSnapshot ? <div><dt className="text-muted-foreground">Email</dt><dd className="mt-1 break-words text-foreground">{pedido.emailClienteSnapshot}</dd></div> : null}
          </dl>
          {pedido.clienteId ? <ActionLink href={`${ROUTES.adminCustomer(pedido.clienteId)}#cuenta-corriente-title`} variant="quiet" className="mt-3">Consultar cuenta corriente</ActionLink> : <p className="mt-3 text-sm text-muted-foreground">Sin cliente asociado para consultar cuenta corriente.</p>}
        </section>

        <section className="min-w-0 rounded-xl border border-border bg-card p-4 shadow-sm">
          <h2 className="text-sm font-semibold tracking-tight text-foreground">Entrega</h2>
          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
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
      <div className="grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section className="min-w-0 rounded-xl border border-border bg-card p-4 shadow-sm">
          <h2 className="text-sm font-semibold tracking-tight text-foreground">Productos</h2>
          {pedido.items.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">No hay productos registrados.</p> : null}
          <ul className="mt-3 divide-y divide-border">
            {pedido.items.map((item) => <li key={item.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-2 py-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
              <div className="col-span-2 flex min-w-0 items-center gap-3 sm:col-span-1">
                <div className="relative size-10 shrink-0 overflow-hidden rounded-lg bg-muted">
                  <CatalogImage image={item.rutaImagen ? { src: item.rutaImagen, alt: "", fit: "contain" } : undefined} fallback="package" sizes="40px" fallbackIconClassName="size-6" />
                </div>
                <div className="min-w-0"><h3 className="font-medium text-foreground">{item.nombreProductoSnapshot}</h3><p className="mt-1 text-sm text-muted-foreground">{item.nombrePresentacionSnapshot ?? "Presentación no registrada"}</p></div>
              </div>
              <dl className="grid grid-cols-2 gap-3 text-xs"><div><dt className="text-muted-foreground">Cantidad</dt><dd className="mt-1 font-medium text-foreground">{formatearCantidadPedido(item.cantidad, item.unidadSnapshot)}</dd></div><div><dt className="text-muted-foreground">Precio unitario (snapshot)</dt><dd className="mt-1 font-medium text-foreground">{formatCLP(item.precioFinalUnitarioSnapshot)}</dd></div></dl>
              <div className="text-right text-sm"><p className="text-xs text-muted-foreground">Subtotal</p><p className="mt-1 font-semibold tabular-nums text-foreground">{formatCLP(item.totalLinea)}</p></div>
            </li>)}
          </ul>
        </section>

        <section className="min-w-0 rounded-xl border border-border bg-card p-4 shadow-sm">
          <h2 className="text-sm font-semibold tracking-tight text-foreground">Totales y pago previsto</h2>
          <dl className="mt-3 grid gap-2 text-sm">
            {pedido.preparacionEstado ? <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Preparación</dt><dd className="font-medium text-foreground">{pedido.preparacionEstado === "incompleta" ? "Incompleta" : pedido.preparacionEstado === "completa" ? "Completa" : "Pendiente"}</dd></div> : null}
            <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Subtotal</dt><dd>{formatCLP(pedido.subtotal)}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Costo entrega</dt><dd>{formatCLP(pedido.costoEntrega)}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Descuento</dt><dd>{formatCLP(pedido.descuento)}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Pago previsto</dt><dd className="text-right font-medium text-foreground">{pagoPrevisto}</dd></div>
            <div className="flex justify-between gap-3 border-t border-border pt-2 font-semibold text-foreground"><dt className="text-muted-foreground">Total original</dt><dd>{formatCLP(pedido.total)}</dd></div>
            {pedido.subtotalFinal !== null ? <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Subtotal final</dt><dd>{formatCLP(pedido.subtotalFinal)}</dd></div> : null}
            {pedido.totalFinal !== null ? <div className="flex justify-between gap-3 text-base font-semibold text-foreground"><dt>Total final</dt><dd>{formatCLP(pedido.totalFinal)}</dd></div> : null}
          </dl>
          <p className="mt-3 text-sm text-muted-foreground">Los métodos de pago previstos no acreditan pagos.</p>
        </section>

      </div>
      <section className="min-w-0 rounded-xl border border-border bg-card p-4 shadow-sm" aria-labelledby="historial-precios-title">
        <a href={`/admin/pedidos/${pedido.id}/historial`} className="inline-flex min-h-11 items-center text-sm font-semibold text-primary underline underline-offset-4">Ver historial de auditoría del pedido</a>
        <h2 id="historial-precios-title" className="text-sm font-semibold tracking-tight text-foreground">Historial de ajustes de precios administrativos</h2>
        <p className="mt-2 text-sm text-muted-foreground">Ajustes registrados al crear el pedido administrativo.</p>
        {pedido.historialPrecios === null ? <p className="mt-3 text-sm text-muted-foreground">El historial de ajustes administrativos todavía no está disponible en este entorno.</p> : pedido.historialPrecios.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">Sin ajustes de precios administrativos registrados para este pedido. Los pedidos históricos, web o convertidos pueden no tener registros en esta auditoría.</p> : (
          <ul className="mt-3 divide-y divide-border">
            {pedido.historialPrecios.map((ajuste) => {
              const item = pedido.items.find((producto) => producto.id === ajuste.itemPedidoId);
              return <li key={ajuste.itemPedidoId} className="space-y-2 py-3">
                <h3 className="font-medium text-foreground">{item ? [item.nombreProductoSnapshot, item.nombrePresentacionSnapshot].filter(Boolean).join(" · ") : "Producto no disponible"}</h3>
                <dl className="grid gap-3 text-sm sm:grid-cols-2">
                  <div><dt className="text-muted-foreground">{ajuste.totalOriginal === null ? "Precio de referencia unitario" : "Total original de línea"}</dt><dd className="mt-1">{formatCLP(ajuste.totalOriginal ?? ajuste.precioReferencia)}</dd></div>
                  <div><dt className="text-muted-foreground">{ajuste.totalAplicado === null ? "Precio aplicado unitario" : "Total final de línea"}</dt><dd className="mt-1">{formatCLP(ajuste.totalAplicado ?? ajuste.precioAplicado ?? 0)}</dd></div>
                  <div className="sm:col-span-2"><dt className="text-muted-foreground">Motivo</dt><dd className="mt-1 whitespace-pre-wrap break-words">{ajuste.motivo}</dd></div>
                  <div><dt className="text-muted-foreground">Actor (ID administrador)</dt><dd className="mt-1 break-all">{ajuste.administradorId}</dd></div>
                  <div><dt className="text-muted-foreground">Fecha de autorización</dt><dd className="mt-1"><time dateTime={ajuste.fechaAutorizacion}>{formatDateTimeCL(ajuste.fechaAutorizacion)}</time></dd></div>
                </dl>
              </li>;
            })}
          </ul>
        )}
      </section>

      {pedido.observacionGeneral ? <section className="min-w-0 rounded-xl border border-border bg-card p-4 shadow-sm"><h2 className="text-sm font-semibold tracking-tight text-foreground">Observación</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{pedido.observacionGeneral}</p></section> : null}
    </div>
  );
}
