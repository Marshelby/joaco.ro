import type { Metadata } from "next";

import { EmptyState } from "@/components/feedback/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { ActionLink } from "@/components/ui/action-link";
import { ROUTES } from "@/config/routes";
import { describirSaldoCuenta, obtenerClientesAdmin } from "@/lib/admin/clientes";
import { formatCLP, formatDateTimeCL } from "@/lib/formatters";

export const metadata: Metadata = { title: "Clientes" };

export default async function AdminCustomersPage() {
  const clientes = await obtenerClientesAdmin();

  return (
    <div className="space-y-8">
      <PageHeader title="Clientes" description="Revisa la cuenta corriente y los pedidos históricos de cada cliente." />
      {clientes.length === 0 ? <EmptyState title="No hay clientes" description="Los clientes aparecerán aquí cuando se creen sus fichas comerciales." /> : <section className="space-y-3" aria-label="Clientes">{clientes.map((cliente) => {
        const saldo = describirSaldoCuenta(cliente.saldoActual);
        return <article key={cliente.id} className="rounded-xl border border-border bg-card p-4 sm:p-5"><div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(10rem,0.65fr)_auto] sm:items-center sm:gap-5"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold tracking-tight text-foreground">{cliente.nombre}</h2>{!cliente.activo ? <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">Inactivo</span> : null}</div>{cliente.telefono ? <p className="mt-2 text-sm text-muted-foreground">{cliente.telefono}</p> : null}{cliente.email ? <p className="mt-1 break-words text-sm text-muted-foreground">{cliente.email}</p> : null}</div><dl className="grid grid-cols-2 gap-3 text-sm sm:block"><div><dt className="text-muted-foreground">Cuenta corriente</dt><dd className="mt-1 font-semibold text-foreground">{saldo.texto === "Al día" ? formatCLP(0) : `${saldo.texto === "Debe" ? "Debe " : ""}${formatCLP(saldo.monto)}${saldo.texto === "A favor" ? " a favor" : ""}`}</dd></div><div className="sm:mt-3"><dt className="text-muted-foreground">Pedidos</dt><dd className="mt-1 font-medium text-foreground">{cliente.cantidadPedidos} · {cliente.fechaUltimoMovimiento ? formatDateTimeCL(cliente.fechaUltimoMovimiento) : "Sin movimientos"}</dd></div></dl><ActionLink href={ROUTES.adminCustomer(cliente.id)} variant="quiet" aria-label={`Ver cliente ${cliente.nombre}`}>Ver cliente</ActionLink></div></article>;
      })}</section>}
    </div>
  );
}
