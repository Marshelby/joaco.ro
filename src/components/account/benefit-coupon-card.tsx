type BenefitCouponCardProps = {
  id: string;
};

export function BenefitCouponCard({ id }: BenefitCouponCardProps) {
  return (
    <article aria-labelledby={`cupon-${id}`} className="rounded-xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id={`cupon-${id}`} className="text-lg font-semibold tracking-tight text-foreground">10% de descuento</h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Úsalo cuando quieras en una próxima compra.</p>
        </div>
        <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-secondary-foreground">Disponible</span>
      </div>
    </article>
  );
}
