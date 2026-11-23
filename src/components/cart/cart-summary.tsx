import { cotizarDespacho } from "@/lib/delivery-pricing";
import { formatCLP } from "@/lib/formatters";

export function CartSummary({ subtotal, className }: { subtotal: number; className?: string }) {
  const cotizacion = cotizarDespacho(subtotal);

  return (
    <div className={className}>
      <dl className="space-y-3 text-sm">
        <div className="flex items-center justify-between gap-4"><dt className="text-muted-foreground">Subtotal</dt><dd className="font-medium text-foreground">{formatCLP(cotizacion.subtotal)}</dd></div>
        <div className="flex items-center justify-between gap-4"><dt className="text-muted-foreground">Despacho</dt><dd className="font-medium text-foreground">{cotizacion.costoEntrega > 0 ? formatCLP(cotizacion.costoEntrega) : "Gratis"}</dd></div>
        <div className="flex items-end justify-between gap-4 border-t border-border pt-4"><dt className="font-medium text-muted-foreground">Total estimado</dt><dd><strong className="text-2xl tracking-tight text-foreground">{formatCLP(cotizacion.totalEstimado)}</strong></dd></div>
      </dl>
      {!cotizacion.tieneDespachoGratis ? <p className="mt-4 rounded-lg bg-primary/10 px-3 py-2 text-sm leading-5 text-primary">Agrega {formatCLP(cotizacion.faltanteParaGratis)} más y obtén despacho gratis.</p> : null}
      <p className="mt-3 text-xs leading-5 text-muted-foreground">El total es referencial. Precio y disponibilidad se validarán antes de crear un pedido.</p>
    </div>
  );
}
