import { actionLinkVariants } from "@/components/ui/action-link";
import { ROUTES } from "@/config/routes";

export function CreateOrderLink({ clienteId }: { clienteId?: string }) {
  // El creador siempre abre su página completa, fuera de los slots de detalle.
  // La navegación del navegador conserva el origen para el botón Atrás.
  return <a href={ROUTES.adminNewOrder(clienteId)} className={actionLinkVariants()}>Crear pedido</a>;
}
