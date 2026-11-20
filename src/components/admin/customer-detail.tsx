import { CreateOrderLink } from "@/components/admin/create-order-link";
import { OrderCustomerMessagesLink, CustomerOrderLink } from "@/components/admin/order-customer-navigation";
import { AdministrativeCorrection } from "@/components/admin/administrative-correction";
import { CustomerCommercialAddresses, CustomerCommercialForm } from "@/components/admin/customer-commercial-form";
import { leerFichaComercial, zonasComerciales } from "@/lib/admin/cliente-comercial";
import { notFound } from "next/navigation";

import { CustomerAdjustmentForm } from "@/components/admin/customer-adjustment-form";
import { CustomerHistorySection } from "@/components/admin/customer-history-section";
import { CustomerPaymentForm } from "@/components/admin/customer-payment-form";
import { CustomerWebAccess } from "@/components/admin/customer-web-access";
import { PaymentVoidAction } from "@/components/admin/payment-void-action";
import { OrderStatusBadge } from "@/components/admin/order-status-badge";
import { EmptyState } from "@/components/feedback/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { ActionLink } from "@/components/ui/action-link";
import { ROUTES } from "@/config/routes";
import { describirSaldoCuenta, obtenerClienteAdmin, type MovimientoCuentaCliente } from "@/lib/admin/clientes";
import { formatCLP, formatDateTimeCL } from "@/lib/formatters";

function tituloMovimiento(movimiento: MovimientoCuentaCliente) {
  if (movimiento.tipo === "pedido") return movimiento.referencia;
  if (movimiento.tipo === "pago") return "Pago";
  return "Ajuste";
}

function descripcionMovimiento(movimiento: MovimientoCuentaCliente) {
  if (movimiento.tipo === "pedido") return movimiento.concepto;
  if (movimiento.tipo === "pago") return `${movimiento.concepto} · ${movimiento.referencia}`;
  return movimiento.concepto;
}

export async function AdminCustomerDetail({ id, readOnly = false }: { id: string; readOnly?: boolean }) {
  const cliente = await obtenerClienteAdmin(id);
  if (!cliente) notFound();
  const [zonas, ficha] = await Promise.all([zonasComerciales(), leerFichaComercial(id)]);
  const saldo = describirSaldoCuenta(cliente.saldoActual);
  const interpretacion = saldo.texto === "Al día" ? "La cuenta está al día." : saldo.texto === "Debe" ? `Debe ${formatCLP(saldo.monto)} a Hidro Leufú.` : `Tiene ${formatCLP(saldo.monto)} a favor.`;

  return (
    <div className="@container min-w-0 space-y-6 sm:space-y-8">
      <PageHeader className="min-w-0 items-start rounded-2xl border bg-card p-4 wrap-anywhere sm:flex-col sm:items-start sm:p-6 @5xl:flex-row @5xl:items-center" title={cliente.nombre} description={[cliente.email, cliente.telefono].filter(Boolean).join(" · ") || "Sin datos de contacto."} actions={<div className="flex min-w-0 flex-wrap gap-2">{!readOnly && <CreateOrderLink clienteId={cliente.id} />}{readOnly ? <OrderCustomerMessagesLink /> : <ActionLink href={ROUTES.adminCustomerMessages(cliente.id)} variant="primary">Enviar mensaje</ActionLink>}{!readOnly && <ActionLink href={ROUTES.adminCustomers} variant="secondary">Volver a clientes</ActionLink>}</div>} />
      {!readOnly && <CustomerCommercialForm clienteId={cliente.id} zonas={zonas} />}
      {readOnly && <p className="whitespace-pre-wrap text-sm text-muted-foreground">{cliente.activo ? "Cliente activo" : "Cliente inactivo"}{ficha.cliente.observaciones ? ` · ${ficha.cliente.observaciones}` : ""}</p>}
      <CustomerCommercialAddresses key={ficha.revision} ficha={ficha} zonas={zonas} readOnly={readOnly} />
      <CustomerWebAccess readOnly={readOnly} clienteId={cliente.id} clienteActivo={cliente.activo} usuarioId={cliente.usuarioId} invitacion={cliente.invitacionAcceso} />
      <section className="space-y-5" aria-labelledby="cuenta-corriente-title"><div><h2 id="cuenta-corriente-title" className="text-2xl font-semibold tracking-tight text-foreground">Cuenta corriente</h2><p className="mt-2 text-sm text-muted-foreground">Resumen derivado de pedidos no cancelados, pagos confirmados y ajustes históricos.</p></div><div className={`grid gap-4 ${readOnly ? "" : "@min-[70rem]:grid-cols-3"}`}><div className="rounded-2xl border border-border bg-card p-4 sm:p-6"><p className="text-sm font-medium text-muted-foreground">Saldo actual</p><p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums text-foreground">{formatCLP(saldo.monto)}</p><p className="mt-2 text-sm font-medium text-foreground">{interpretacion}</p><dl className="mt-5 grid grid-cols-2 gap-3 border-t border-border pt-4 text-sm tabular-nums"><div><dt className="text-muted-foreground">Pedidos</dt><dd className="mt-1 font-semibold text-foreground">{formatCLP(cliente.totalPedidos)}</dd></div><div><dt className="text-muted-foreground">Pagos confirmados</dt><dd className="mt-1 font-semibold text-foreground">{formatCLP(cliente.totalPagosConfirmados)}</dd></div><div><dt className="text-muted-foreground">Ajustes cargo</dt><dd className="mt-1 font-semibold text-foreground">{formatCLP(cliente.totalAjustesCargo)}</dd></div><div><dt className="text-muted-foreground">Ajustes abono</dt><dd className="mt-1 font-semibold text-foreground">{formatCLP(cliente.totalAjustesAbono)}</dd></div></dl></div>{!readOnly && <><CustomerPaymentForm clienteId={cliente.id} saldoActual={cliente.saldoActual} /><CustomerAdjustmentForm clienteId={cliente.id} /></>}</div></section>
      <CustomerHistorySection section="movimientos" count={cliente.movimientos.length}>
        <p className="text-sm text-muted-foreground">Más recientes primero.</p>
        {cliente.movimientos.length > 0 ? (
          <ol className="space-y-2">
            {cliente.movimientos.map((movimiento) => (
              <li key={`${movimiento.tipo}:${movimiento.id}`} className="rounded-xl border border-border bg-muted/25 p-3 wrap-anywhere sm:p-4">
                <div className="grid grid-cols-2 gap-3 @lg:grid-cols-[minmax(0,1fr)_auto_auto] @lg:items-center @lg:gap-5">
                  <div className="col-span-2 min-w-0 @lg:col-span-1">
                    <h3 className="font-semibold text-foreground">{tituloMovimiento(movimiento)}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{descripcionMovimiento(movimiento)}</p>
                    <time dateTime={movimiento.fecha} className="mt-2 block text-sm text-muted-foreground">{formatDateTimeCL(movimiento.fecha)}</time>
                  </div>
                  <div className="text-sm tabular-nums">
                    <p className="text-muted-foreground">{movimiento.cargo > 0 ? "Cargo" : "Abono"}</p>
                    <p className="mt-1 font-semibold text-foreground">{movimiento.cargo > 0 ? `+${formatCLP(movimiento.cargo)}` : `-${formatCLP(movimiento.abono)}`}</p>
                  </div>
                  <div className="text-sm tabular-nums @lg:text-right">
                    <p className="text-muted-foreground">Saldo</p>
                    <p className="mt-1 font-semibold text-foreground">{formatCLP(movimiento.saldoAcumulado)}</p>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <EmptyState title="Este cliente todavía no tiene movimientos" description="Los pedidos, pagos confirmados y ajustes aparecerán aquí." />
        )}
      </CustomerHistorySection>

      <CustomerHistorySection section="pagos" count={cliente.pagos.length}>
        <p className="text-sm text-muted-foreground">Los pagos anulados se conservan como historial y ya no afectan la cuenta.</p>
        {cliente.pagos.length > 0 ? (
          <ul className="space-y-2">
            {cliente.pagos.map((pago) => (
              <li key={pago.id} className="rounded-xl border border-border bg-muted/25 p-3 wrap-anywhere sm:p-4">
                <div className="grid gap-3 @xl:grid-cols-[minmax(0,1fr)_auto_auto] @xl:items-center @xl:gap-5">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-foreground">{pago.estado === "anulado" ? "Pago anulado" : "Pago"}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{pago.metodoPago}{pago.referencia ? ` · ${pago.referencia}` : ""}</p>
                    <time dateTime={pago.fechaPago} className="mt-2 block text-sm text-muted-foreground">{formatDateTimeCL(pago.fechaPago)}</time>
                  </div>
                  <dl className="grid grid-cols-2 gap-3 text-sm tabular-nums @xl:block">
                    <div><dt className="text-muted-foreground">Monto</dt><dd className="mt-1 font-semibold text-foreground">{formatCLP(pago.monto)}</dd></div>
                    <div className="@xl:mt-2"><dt className="text-muted-foreground">Disponible</dt><dd className="mt-1 font-medium text-foreground">{formatCLP(pago.montoDisponible)}</dd></div>
                  </dl>
                  {!readOnly && pago.estado === "confirmado" ? <PaymentVoidAction clienteId={cliente.id} pagoId={pago.id} /> : <span className="text-sm text-muted-foreground">{pago.estado === "anulado" ? "Anulado" : pago.estado}</span>}
                </div>
                {!readOnly && <AdministrativeCorrection tipo="pago" id={pago.id} />}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="Este cliente todavía no tiene pagos" description="Los pagos registrados aparecerán aquí." />
        )}
      </CustomerHistorySection>
      <section className="space-y-4" aria-labelledby="pedidos-cliente-title"><div><h2 id="pedidos-cliente-title" className="text-2xl font-semibold tracking-tight text-foreground">Pedidos</h2><p className="mt-2 text-sm text-muted-foreground">Historial basado en los snapshots del pedido.</p></div>{cliente.pedidos.length > 0 ? <ul className="space-y-3">{cliente.pedidos.map((pedido) => <li key={pedido.id} className="rounded-xl border border-border bg-card p-4 sm:p-5"><div className="grid gap-4 @2xl:grid-cols-[minmax(0,1fr)_auto_auto_auto_auto] @2xl:items-center @2xl:gap-5"><div><h3 className="font-semibold text-foreground">{pedido.numeroPedido}</h3><time dateTime={pedido.fechaCreacion} className="mt-1 block text-sm text-muted-foreground">{formatDateTimeCL(pedido.fechaCreacion)}</time></div><OrderStatusBadge estado={pedido.estado} /><p className="font-semibold text-foreground">{formatCLP(pedido.total)}</p><p className="text-sm font-medium text-foreground">{pedido.saldoPendiente > 0 ? `Pendiente: ${formatCLP(pedido.saldoPendiente)}` : "Pagado"}</p>{!readOnly && <CustomerOrderLink href={ROUTES.adminOrder(pedido.id)} scroll={false} prefetch={false} variant="quiet" aria-label={`Ver pedido ${pedido.numeroPedido}`}>Ver pedido</CustomerOrderLink>}</div></li>)}</ul> : <EmptyState title="Este cliente todavía no tiene pedidos" description="Los pedidos futuros aparecerán aquí." />}</section>
    </div>
  );
}
