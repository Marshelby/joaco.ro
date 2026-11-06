import type { Metadata } from "next";
import { z } from "zod";
import { OrderCustomerSelection } from "@/components/admin/order-customer-selection";
import { cargarClientePedido } from "./actions";

import { PageHeader } from "@/components/shared/page-header";
import { ActionLink } from "@/components/ui/action-link";
import { ROUTES } from "@/config/routes";

export const metadata: Metadata = { title: "Crear pedido" };

const etapas = [
  { id: "cliente", titulo: "Cliente y ubicación comercial" },
  { id: "productos", titulo: "Productos y cantidades" },
  { id: "precios", titulo: "Precios" },
  { id: "entrega", titulo: "Fecha de entrega y métodos de pago" },
  { id: "confirmacion", titulo: "Resumen y confirmación" },
] as const;

export default async function AdminNewOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ cliente_id?: string | string[] }>;
}) {
  const { cliente_id: parametroCliente } = await searchParams;
  const resultado = z.uuid().safeParse(parametroCliente);
  let inicial: Awaited<ReturnType<typeof cargarClientePedido>> | null = null;
  let errorInicial = parametroCliente !== undefined && !resultado.success
    ? "El enlace contiene una referencia de cliente inválida. No se preseleccionó ningún cliente."
    : "";
  if (resultado.success) {
    try {
      inicial = await cargarClientePedido(resultado.data);
    } catch {
      errorInicial = "No fue posible validar el cliente del enlace, sus ubicaciones y saldo. Busca y selecciona un cliente activo nuevamente.";
    }
  }
  const clienteIdInicial = inicial?.cliente.id;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Crear pedido"
        eyebrow="Gestión administrativa"
        description="Prepara un pedido para un cliente y su ubicación comercial."
        actions={<ActionLink href={clienteIdInicial ? ROUTES.adminCustomer(clienteIdInicial) : ROUTES.adminOrders} variant="secondary">{clienteIdInicial ? "Volver al cliente" : "Volver a pedidos"}</ActionLink>}
      />

      <div id="estado-integracion" role="status" className="rounded-xl border border-border bg-muted/40 p-4 text-sm leading-6 text-muted-foreground">
        Selecciona un cliente, su ubicación comercial y los productos. Revisa los precios por línea y selecciona fecha de entrega y métodos previstos de pago; la confirmación permanece deshabilitada.
      </div>
      {errorInicial ? <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{errorInicial}</p> : null}

      <div className="grid items-start gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <nav aria-label="Etapas de creación del pedido" className="rounded-xl border border-border bg-card p-4 lg:sticky lg:top-6">
          <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
            {etapas.map((etapa, indice) => (
              <li key={etapa.id}>
                <a href={`#${etapa.id}`} className="flex min-h-11 items-center gap-3 rounded-lg p-2 text-sm font-medium text-foreground outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs">{indice + 1}</span>
                  {etapa.titulo}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div role="group" aria-label="Crear pedido administrativo" aria-describedby="estado-integracion" className="min-w-0 space-y-5">
          <OrderCustomerSelection inicial={inicial} />

        </div>
      </div>
    </div>
  );
}
