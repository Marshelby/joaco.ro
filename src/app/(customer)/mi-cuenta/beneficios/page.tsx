import type { Metadata } from "next";

import { BenefitCard } from "@/components/account/benefit-card";
import { BenefitParticipationList } from "@/components/account/benefit-participation-list";
import { EmptyState } from "@/components/feedback/empty-state";
import { getActiveCustomerBenefitParticipations, getActiveCustomerBenefits, getCompletedCustomerBenefits, getCustomerBenefitParticipation, getFeaturedCustomerBenefit, getLatestCustomerBenefitParticipation } from "@/lib/benefits";
import { formatDateCL } from "@/lib/formatters";
import { CUSTOMER_BENEFITS_MOCK, CUSTOMER_BENEFIT_PARTICIPATIONS_MOCK } from "@/mocks/benefits";
import { PageHeader } from "@/components/shared/page-header";

export const metadata: Metadata = { title: "Mis beneficios" };

export default function CustomerBenefitsPage() {
  const benefits = CUSTOMER_BENEFITS_MOCK;
  const featuredBenefit = getFeaturedCustomerBenefit(benefits);
  const activeBenefits = getActiveCustomerBenefits(benefits);
  const completedBenefits = getCompletedCustomerBenefits(benefits);
  const activeBenefitCount = benefits.filter((benefit) => benefit.status === "active").length;
  const activeParticipations = getActiveCustomerBenefitParticipations(CUSTOMER_BENEFIT_PARTICIPATIONS_MOCK);
  const latestParticipation = getLatestCustomerBenefitParticipation(CUSTOMER_BENEFIT_PARTICIPATIONS_MOCK);
  const participationEntries = CUSTOMER_BENEFIT_PARTICIPATIONS_MOCK.flatMap((participation) => {
    const benefit = benefits.find((item) => item.id === participation.benefitId);
    return benefit ? [{ participation, benefit }] : [];
  });

  return (
    <div className="space-y-8">
      <PageHeader title="Mis beneficios" description="Revisa tus promociones, sorteos y campañas disponibles." />
      {benefits.length === 0 ? <EmptyState title="No hay beneficios disponibles" description="Cuando existan nuevas promociones o sorteos, podrás revisarlos desde aquí." /> : <>
        <section className="grid gap-4 rounded-xl border border-border bg-card p-5 text-sm sm:grid-cols-3" aria-label="Resumen de beneficios">
          <div><p className="text-muted-foreground">Beneficios activos</p><p className="mt-1 text-xl font-semibold text-foreground">{activeBenefitCount}</p></div>
          <div><p className="text-muted-foreground">Participaciones vigentes</p><p className="mt-1 text-xl font-semibold text-foreground">{activeParticipations.length}</p></div>
          <div><p className="text-muted-foreground">Última participación</p><p className="mt-1 font-semibold text-foreground">{latestParticipation ? <time dateTime={latestParticipation.participatedAt}>{formatDateCL(latestParticipation.participatedAt)}</time> : "Sin participaciones"}</p></div>
        </section>

        {featuredBenefit ? <section aria-labelledby="featured-benefit-title"><h2 id="featured-benefit-title" className="mb-4 text-lg font-semibold tracking-tight text-foreground">Destacado</h2><BenefitCard benefit={featuredBenefit} participation={getCustomerBenefitParticipation(CUSTOMER_BENEFIT_PARTICIPATIONS_MOCK, featuredBenefit.id)} featured /></section> : null}

        {activeBenefits.length > 0 ? <section aria-labelledby="active-benefits-title"><h2 id="active-benefits-title" className="mb-4 text-lg font-semibold tracking-tight text-foreground">Activos</h2><div className="space-y-4">{activeBenefits.map((benefit) => <BenefitCard key={benefit.id} benefit={benefit} participation={getCustomerBenefitParticipation(CUSTOMER_BENEFIT_PARTICIPATIONS_MOCK, benefit.id)} />)}</div></section> : null}

        {completedBenefits.length > 0 ? <section aria-labelledby="completed-benefits-title"><h2 id="completed-benefits-title" className="mb-4 text-lg font-semibold tracking-tight text-foreground">Finalizados</h2><div className="space-y-4">{completedBenefits.map((benefit) => <BenefitCard key={benefit.id} benefit={benefit} participation={getCustomerBenefitParticipation(CUSTOMER_BENEFIT_PARTICIPATIONS_MOCK, benefit.id)} />)}</div></section> : null}

        <section aria-labelledby="participations-title" className="rounded-xl border border-border bg-card p-5 sm:p-6"><h2 id="participations-title" className="text-lg font-semibold tracking-tight text-foreground">Mis participaciones</h2><div className="mt-5">{participationEntries.length > 0 ? <BenefitParticipationList entries={participationEntries} /> : <EmptyState title="Aún no tienes participaciones" description="Tus participaciones aparecerán aquí cuando formes parte de una campaña o sorteo." />}</div></section>
      </>}
    </div>
  );
}
