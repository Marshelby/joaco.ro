import type { Metadata } from "next";

import { BenefitCouponCard } from "@/components/account/benefit-coupon-card";
import { BenefitsProgressCard } from "@/components/account/benefits-progress-card";
import { EmptyState } from "@/components/feedback/empty-state";
import { obtenerBeneficiosCuenta } from "@/lib/account/beneficios";
import { PageHeader } from "@/components/shared/page-header";

export const metadata: Metadata = { title: "Mis beneficios" };

export default async function CustomerBenefitsPage() {
  const beneficios = await obtenerBeneficiosCuenta();

  return (
    <div className="space-y-8">
      <PageHeader title="Mis beneficios" description="Revisa tus compras acumuladas y cupones disponibles." />
      {!beneficios ? <EmptyState title="No tienes una cuenta de cliente activa" description="No podemos mostrar beneficios para esta cuenta." /> : <div className="grid gap-5 lg:grid-cols-2">
        <BenefitsProgressCard comprasAcumuladas={beneficios.comprasAcumuladas} />
        <section aria-labelledby="cupones-disponibles-title" className="space-y-4">
          <div>
            <h2 id="cupones-disponibles-title" className="text-lg font-semibold tracking-tight text-foreground">Cupones disponibles</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">Tus descuentos estarán listos cuando decidas usarlos.</p>
          </div>
          {beneficios.cuponesDisponibles.length > 0 ? <div className="space-y-3">{beneficios.cuponesDisponibles.map((cupon) => <BenefitCouponCard key={cupon.id} id={cupon.id} />)}</div> : <p className="rounded-xl border border-border bg-card p-5 text-sm leading-6 text-muted-foreground">Aún no tienes cupones disponibles.</p>}
        </section>
      </div>}
    </div>
  );
}
