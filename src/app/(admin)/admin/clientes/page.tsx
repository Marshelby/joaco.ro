import { CustomerMessagesAccess } from "@/components/admin/customer-messages-access";
import { CustomerSearch } from "@/components/admin/customer-search";
import { CustomerCommercialForm } from "@/components/admin/customer-commercial-form";
import { zonasComerciales } from "@/lib/admin/cliente-comercial";
import type { Metadata } from "next";

import { PageHeader } from "@/components/shared/page-header";
import { ActionLink } from "@/components/ui/action-link";
import { ROUTES } from "@/config/routes";
import { describirSaldoCuenta, obtenerClientesAdmin } from "@/lib/admin/clientes";
import { formatCLP, formatDateTimeCL } from "@/lib/formatters";

export const metadata: Metadata = { title: "Clientes" };

function leerPagina(valor: string | string[] | undefined) {
  const numero = typeof valor === "string" ? Number(valor) : 1;
  return Number.isSafeInteger(numero) && numero > 0 ? Math.min(numero, 100000) : 1;
}

export default async function AdminCustomersPage({ searchParams }: {
  searchParams: Promise<{ q?: string | string[]; pagina?: string | string[]; con?: string | string[]; sin?: string | string[] }>;
}) {
  const parametros = await searchParams;
  const busqueda = typeof parametros.q === "string" ? parametros.q.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 120) : "";
  const [conFactura, sinFactura, zonas] = await Promise.all([
    obtenerClientesAdmin(busqueda, leerPagina(parametros.con), 100000, "con"),
    obtenerClientesAdmin(busqueda, leerPagina(parametros.sin ?? parametros.pagina), 100000, "sin"),
    zonasComerciales(),
  ]);
  const paginas = { con: conFactura.pagina, sin: sinFactura.pagina };
  const grupos = [
    { clave: "con", titulo: "Clientes con factura", resultado: conFactura },
    { clave: "sin", titulo: "Clientes sin factura", resultado: sinFactura },
  ] as const;

  function enlacePagina(clave: "con" | "sin", numero: number) {
    const consulta = new URLSearchParams(busqueda ? { q: busqueda } : {});
    const seleccion = { ...paginas, [clave]: numero };
    if (seleccion.con > 1) consulta.set("con", String(seleccion.con));
    if (seleccion.sin > 1) consulta.set("sin", String(seleccion.sin));
    return `/admin/clientes${consulta.size ? `?${consulta}` : ""}#clientes-${clave}`;
  }

  return (
    <div className="space-y-8">
      <PageHeader title="Clientes" description="Revisa la cuenta corriente y los pedidos históricos de cada cliente." actions={<CustomerMessagesAccess />} />
      <CustomerCommercialForm zonas={zonas} />
      <CustomerSearch busqueda={busqueda} total={conFactura.total + sinFactura.total} />
      <div id="resultados-clientes" className="space-y-8">
        {grupos.map(({ clave, titulo, resultado: { clientes, total, porPagina, pagina } }) => (
          <section key={clave} id={`clientes-${clave}`} aria-labelledby={`titulo-clientes-${clave}`} className="scroll-mt-4 space-y-3 rounded-2xl border border-border bg-muted/30 p-3 sm:p-4">
            <h2 id={`titulo-clientes-${clave}`} className="flex flex-wrap items-center gap-2 text-lg font-semibold tracking-tight">
              {titulo} <span className="rounded-full bg-muted px-2.5 py-0.5 text-sm tabular-nums">{total}</span>
            </h2>
            {clientes.length === 0 ? <p className="rounded-xl border border-dashed bg-card p-4 text-sm text-muted-foreground">{busqueda ? "Sin coincidencias en esta lista." : "Sin clientes en esta lista."}</p> : <div className="space-y-3">{clientes.map((cliente) => {
              const saldo = describirSaldoCuenta(cliente.saldoActual);
              return (
                <article key={cliente.id} className="rounded-xl border border-border bg-card p-4 sm:p-5">
                  <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(10rem,0.65fr)_auto] sm:items-center sm:gap-5">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold tracking-tight text-foreground">{cliente.nombre}</h3>
                        {!cliente.activo && <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">Inactivo</span>}
                      </div>
                      {cliente.telefono && <p className="mt-2 text-sm text-muted-foreground">{cliente.telefono}</p>}
                      {cliente.email && <p className="mt-1 break-words text-sm text-muted-foreground">{cliente.email}</p>}
                    </div>
                    <dl className="grid grid-cols-2 gap-3 text-sm sm:block">
                      <div>
                        <dt className="text-muted-foreground">Cuenta corriente</dt>
                        <dd className="mt-1 font-semibold text-foreground">{saldo.texto === "Al día" ? formatCLP(0) : `${saldo.texto === "Debe" ? "Debe " : ""}${formatCLP(saldo.monto)}${saldo.texto === "A favor" ? " a favor" : ""}`}</dd>
                      </div>
                      <div className="sm:mt-3">
                        <dt className="text-muted-foreground">Pedidos</dt>
                        <dd className="mt-1 font-medium text-foreground">{cliente.cantidadPedidos} · {cliente.fechaUltimoMovimiento ? formatDateTimeCL(cliente.fechaUltimoMovimiento) : "Sin movimientos"}</dd>
                      </div>
                    </dl>
                    <ActionLink href={ROUTES.adminCustomer(cliente.id)} variant="quiet" aria-label={`Ver cliente ${cliente.nombre}`}>Ver cliente</ActionLink>
                  </div>
                </article>
              );
            })}</div>}
            {total > porPagina && (
              <nav aria-label={`Paginación de ${titulo.toLowerCase()}`} className="flex flex-wrap items-center gap-3">
                {pagina > 1 && <ActionLink href={enlacePagina(clave, pagina - 1)} variant="quiet">Anterior</ActionLink>}
                <span className="text-sm text-muted-foreground">Página {pagina} de {Math.ceil(total / porPagina)}</span>
                {pagina * porPagina < total && <ActionLink href={enlacePagina(clave, pagina + 1)} variant="quiet">Siguiente</ActionLink>}
              </nav>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
