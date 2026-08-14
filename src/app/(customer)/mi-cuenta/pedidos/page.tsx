import type { Metadata } from "next";
import { OrderHistoryCard } from "@/components/account/order-history-card";
import { EmptyState } from "@/components/feedback/empty-state";
import { ROUTES } from "@/config/routes";
import { obtenerPedidosCuenta } from "@/lib/account/pedidos";
import { PageHeader } from "@/components/shared/page-header";
import { ActionLink } from "@/components/ui/action-link";

export const metadata: Metadata = { title: "Mis pedidos" };

export default async function CustomerOrdersPage() {
  const orders = await obtenerPedidosCuenta();

  return (
    <div className="space-y-8">
      <PageHeader title="Mis pedidos" description="Revisa el estado y el historial de tus compras." />
      {orders.length > 0 ? (
        <div className="space-y-3" aria-label="Historial de pedidos">
          {orders.map((order) => <OrderHistoryCard key={order.id} order={order} />)}
        </div>
      ) : (
        <EmptyState
          title="Aún no tienes pedidos"
          description="Cuando realices una compra, podrás revisar su estado desde aquí."
          action={<ActionLink href={ROUTES.catalog}>Ver catálogo</ActionLink>}
        />
      )}
    </div>
  );
}
