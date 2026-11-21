import { OrderCustomerSelection } from "@/components/admin/order-customer-selection";
import { OrderWizard } from "@/components/admin/order-wizard";
import { PageHeader } from "@/components/shared/page-header";
import { ActionLink } from "@/components/ui/action-link";
import { ROUTES } from "@/config/routes";
import { cargarPedidoParaAceptar } from "../../nuevo/actions";

export default async function AceptarPedidoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const aceptacion = await cargarPedidoParaAceptar(id).catch(() => null);

  return (
    <div className="space-y-6">
      <PageHeader
        title={aceptacion ? `Aceptar pedido ${aceptacion.numero}` : "Aceptar pedido"}
        actions={!aceptacion ? <ActionLink href={ROUTES.adminOrders} variant="secondary">Volver a pedidos</ActionLink> : undefined}
      />
      {aceptacion ? (
        <OrderWizard key={id} pasoInicial={4}>
          <OrderCustomerSelection inicial={aceptacion.inicial} aceptacion={aceptacion} />
        </OrderWizard>
      ) : <p role="alert">No fue posible abrir el pedido recibido. Vuelve a pedidos y revisa su estado.</p>}
    </div>
  );
}
