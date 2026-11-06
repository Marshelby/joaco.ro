import type { Metadata } from "next";
import { z } from "zod";
import { OrderWizard } from "@/components/admin/order-wizard";
import { OrderCustomerSelection } from "@/components/admin/order-customer-selection";
import { cargarClientePedido } from "./actions";

import { PageHeader } from "@/components/shared/page-header";
import { ActionLink } from "@/components/ui/action-link";
import { ROUTES } from "@/config/routes";

export const metadata: Metadata = { title: "Crear pedido" };

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

      <div role="group" aria-label="Crear pedido administrativo" aria-describedby="estado-integracion" className="min-w-0">
        <OrderWizard>
          <OrderCustomerSelection inicial={inicial} />
        </OrderWizard>
      </div>
    </div>
  );
}
