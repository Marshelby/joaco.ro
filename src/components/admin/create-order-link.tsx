import { actionLinkVariants } from "@/components/ui/action-link";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/config/routes";

export function CreateOrderLink({ clienteId, className }: { clienteId?: string; className?: string }) {
  // El creador siempre abre su página completa, fuera de los slots de detalle.
  // La navegación del navegador conserva el origen para el botón Atrás.
  return <a href={ROUTES.adminNewOrder(clienteId)} className={cn(actionLinkVariants(), className)}>Crear pedido</a>;
}
