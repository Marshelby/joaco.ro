import { Gift } from "lucide-react";

import { getCustomerBenefitStatusLabel } from "@/lib/benefits";
import { formatDateCL } from "@/lib/formatters";
import type { CustomerBenefitMock, CustomerBenefitParticipationMock } from "@/types/account";

type ParticipationWithBenefit = { participation: CustomerBenefitParticipationMock; benefit: CustomerBenefitMock };

export function BenefitParticipationList({ entries }: { entries: readonly ParticipationWithBenefit[] }) {
  return (
    <ul className="divide-y divide-border">
      {entries.map(({ participation, benefit }) => (
        <li key={participation.id} className="flex gap-3 py-4 first:pt-0 last:pb-0">
          <Gift className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <div className="min-w-0"><h3 className="font-medium text-foreground">{benefit.title}</h3><p className="mt-1 text-sm text-muted-foreground"><time dateTime={participation.participatedAt}>{formatDateCL(participation.participatedAt)}</time> · {getCustomerBenefitStatusLabel(participation.status)}</p>{participation.resultText ? <p className="mt-2 text-sm leading-6 text-foreground">{participation.resultText}</p> : null}</div>
        </li>
      ))}
    </ul>
  );
}
