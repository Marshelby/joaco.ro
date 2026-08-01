import { getCustomerBenefitStatusLabel } from "@/lib/benefits";
import type { CustomerBenefitStatus } from "@/types/account";

const statusClasses: Record<CustomerBenefitStatus, string> = {
  active: "bg-primary/10 text-primary",
  upcoming: "bg-secondary text-secondary-foreground",
  completed: "bg-muted text-muted-foreground",
  used: "bg-secondary text-secondary-foreground",
  expired: "bg-muted text-muted-foreground",
};

export function BenefitStatusBadge({ status }: { status: CustomerBenefitStatus }) {
  return <span className={`inline-flex min-h-7 items-center rounded-full px-2.5 text-xs font-semibold ${statusClasses[status]}`}>{getCustomerBenefitStatusLabel(status)}</span>;
}
