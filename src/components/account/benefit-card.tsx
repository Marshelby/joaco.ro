import { Gift } from "lucide-react";

import { formatCustomerBenefitValidity, getCustomerBenefitStatusLabel, getCustomerBenefitTypeLabel } from "@/lib/benefits";
import { formatDateCL } from "@/lib/formatters";
import type { CustomerBenefitMock, CustomerBenefitParticipationMock } from "@/types/account";

import { BenefitStatusBadge } from "./benefit-status-badge";

type BenefitCardProps = { benefit: CustomerBenefitMock; participation?: CustomerBenefitParticipationMock; featured?: boolean };

export function BenefitCard({ benefit, participation, featured = false }: BenefitCardProps) {
  return (
    <article className={`rounded-xl border border-border bg-card p-5 sm:p-6 ${featured ? "bg-secondary/35" : ""}`} aria-labelledby={`benefit-${benefit.id}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2 text-muted-foreground"><Gift className="size-4" aria-hidden="true" /><span className="text-sm font-medium">{getCustomerBenefitTypeLabel(benefit.type)}</span></div>
        <BenefitStatusBadge status={benefit.status} />
      </div>
      <h3 id={`benefit-${benefit.id}`} className="mt-4 text-lg font-semibold tracking-tight text-foreground">{benefit.title}</h3>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{benefit.description}</p>
      <dl className="mt-5 space-y-3 text-sm">
        <div><dt className="text-muted-foreground">Vigencia</dt><dd className="mt-1 font-medium text-foreground"><time dateTime={benefit.endAt ?? benefit.startAt}>{formatCustomerBenefitValidity(benefit)}</time></dd></div>
        <div><dt className="text-muted-foreground">Información</dt><dd className="mt-1 leading-6 text-foreground">{benefit.eligibilityText}</dd></div>
        {participation ? <div className="border-t border-border pt-3"><dt className="text-muted-foreground">Tu participación</dt><dd className="mt-1 font-medium text-foreground">{participation.resultText ?? getCustomerBenefitStatusLabel(participation.status)}<br /><time className="text-sm font-normal text-muted-foreground" dateTime={participation.participatedAt}>Desde el {formatDateCL(participation.participatedAt)}</time></dd></div> : null}
      </dl>
    </article>
  );
}
