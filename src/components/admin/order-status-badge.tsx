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

export function OrderStatusBadge({ estado, destacado = false }: { estado: EstadoPedidoAdmin; destacado?: boolean }) {
  return <span className={`inline-flex min-h-7 items-center rounded-full px-2.5 ${destacado ? "text-sm ring-1 ring-inset ring-current/20" : "text-xs"} font-semibold ${destacado && estado === "entregado" ? "bg-green-100 text-green-950 dark:bg-green-900 dark:text-green-100" : estilos[estado]}`}>{destacado ? estado === "entregado" ? "Pedido entregado" : estado === "entrega_fallida" ? "No entregado" : `Pedido ${obtenerEtiquetaEstadoPedido(estado).toLocaleLowerCase("es-CL")}` : obtenerEtiquetaEstadoPedido(estado)}</span>;
}
