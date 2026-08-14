import type { EstadoPedidoCuenta } from "@/lib/account/pedidos";

const estados: Record<EstadoPedidoCuenta, { etiqueta: string; className: string }> = {
  recibido: { etiqueta: "Recibido", className: "bg-muted text-muted-foreground" },
  en_revision: { etiqueta: "En revisión", className: "bg-accent/15 text-foreground" },
  confirmado: { etiqueta: "Confirmado", className: "bg-primary/10 text-primary" },
  programado: { etiqueta: "Programado", className: "bg-primary/10 text-primary" },
  preparando: { etiqueta: "Preparando", className: "bg-accent/15 text-foreground" },
  listo_despacho: { etiqueta: "Listo para despacho", className: "bg-primary/10 text-primary" },
  en_reparto: { etiqueta: "En reparto", className: "bg-primary/10 text-primary" },
  entregado: { etiqueta: "Entregado", className: "bg-secondary text-secondary-foreground" },
  entrega_fallida: { etiqueta: "Entrega fallida", className: "bg-destructive/10 text-destructive" },
  cancelado: { etiqueta: "Cancelado", className: "bg-muted text-muted-foreground" },
};

export function getEtiquetaEstadoPedidoCuenta(estado: EstadoPedidoCuenta) {
  return estados[estado].etiqueta;
}

export function CustomerOrderStatusBadge({ estado }: { estado: EstadoPedidoCuenta }) {
  const presentacion = estados[estado];
  return <span className={`inline-flex min-h-7 items-center rounded-full px-2.5 text-xs font-semibold ${presentacion.className}`}>{presentacion.etiqueta}</span>;
}
