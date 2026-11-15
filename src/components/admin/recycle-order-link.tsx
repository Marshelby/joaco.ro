import { actionLinkVariants } from "@/components/ui/action-link";
import { ROUTES } from "@/config/routes";

export function RecycleOrderLink({ pedidoId }: { pedidoId: string }) {
  // Navegación completa: nunca conservar un slot/modal de detalle sobre el creador.
  return <a href={ROUTES.adminRecycleOrder(pedidoId)} className={actionLinkVariants({ variant: "secondary" })}>Reciclar pedido</a>;
}
