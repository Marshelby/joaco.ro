import { obtenerEtiquetaEstadoPedido, type EstadoPedidoAdmin } from "@/lib/admin/pedidos";

const estilos: Record<EstadoPedidoAdmin, string> = {
  recibido: "bg-accent/15 text-foreground",
  en_revision: "bg-muted text-muted-foreground",
  confirmado: "bg-primary/10 text-primary",
  programado: "bg-primary/10 text-primary",
  preparando: "bg-accent/15 text-foreground",
  listo_despacho: "bg-primary/10 text-primary",
  en_reparto: "bg-primary/10 text-primary",
  entregado: "bg-secondary text-secondary-foreground",
  entrega_fallida: "bg-destructive/10 text-destructive",
  cancelado: "bg-muted text-muted-foreground",
};

export function OrderStatusBadge({ estado }: { estado: EstadoPedidoAdmin }) {
  return <span className={`inline-flex min-h-7 items-center rounded-full px-2.5 text-xs font-semibold ${estilos[estado]}`}>{obtenerEtiquetaEstadoPedido(estado)}</span>;
}
