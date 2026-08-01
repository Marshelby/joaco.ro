import { PackageSearch } from "lucide-react";

import { EmptyState } from "@/components/feedback/empty-state";
import { ActionLink } from "@/components/ui/action-link";
import { ROUTES } from "@/config/routes";

export default function CustomerOrderNotFound() {
  return (
    <EmptyState
      headingLevel="h1"
      icon={PackageSearch}
      title="Pedido no encontrado"
      description="No pudimos encontrar el pedido que buscas."
      action={<div className="flex flex-wrap justify-center gap-3">
        <ActionLink href={ROUTES.accountOrders}>Volver a Mis pedidos</ActionLink>
        <ActionLink href={ROUTES.account} variant="secondary">Volver a Mi cuenta</ActionLink>
      </div>}
    />
  );
}
