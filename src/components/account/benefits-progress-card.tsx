type BenefitsProgressCardProps = {
  comprasAcumuladas: number;
};

const COMPRAS_POR_CUPON = 5;

export function BenefitsProgressCard({ comprasAcumuladas }: BenefitsProgressCardProps) {
  const progresoInconsistente = comprasAcumuladas >= COMPRAS_POR_CUPON;
  const progresoSeguro = Math.min(Math.max(comprasAcumuladas, 0), COMPRAS_POR_CUPON - 1);
  const comprasFaltantes = COMPRAS_POR_CUPON - progresoSeguro;

  return (
    <section aria-labelledby="compras-acumuladas-title" className="rounded-xl border border-border bg-card p-5 sm:p-6">
      <h2 id="compras-acumuladas-title" className="text-lg font-semibold tracking-tight text-foreground">Tus compras acumuladas</h2>
      <p className="mt-4 text-3xl font-semibold tracking-tight text-foreground">{progresoInconsistente ? "5 o más" : progresoSeguro} <span className="text-lg font-medium text-muted-foreground">de 5 compras</span></p>
      <div className="mt-4 flex gap-2" aria-hidden="true">
        {Array.from({ length: COMPRAS_POR_CUPON }, (_, index) => <span key={index} className={`h-2.5 flex-1 rounded-full ${index < (progresoInconsistente ? COMPRAS_POR_CUPON : progresoSeguro) ? "bg-primary" : "bg-muted"}`} />)}
      </div>
      <p className="mt-5 text-sm leading-6 text-foreground">Completa 5 compras sobre $15.000 y recibe un 10% de descuento.</p>
      {progresoInconsistente ? <p className="mt-2 text-sm leading-6 text-muted-foreground">Tu progreso se está actualizando. Vuelve a intentarlo en unos minutos.</p> : <p className="mt-2 text-sm leading-6 text-muted-foreground">Te falta{comprasFaltantes === 1 ? " 1 compra" : `n ${comprasFaltantes} compras`} para obtener tu próximo cupón.</p>}
      <p className="mt-4 text-sm leading-6 text-muted-foreground">Las compras se acumulan una vez entregadas.</p>
    </section>
  );
}
