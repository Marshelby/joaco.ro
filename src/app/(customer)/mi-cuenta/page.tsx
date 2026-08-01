import type { Metadata } from "next";

import { AccountSummary } from "@/components/account/account-summary";
import { EmptyState } from "@/components/feedback/empty-state";
import { getPrimaryCustomerAddress } from "@/lib/addresses";
import { getFeaturedCustomerBenefit } from "@/lib/benefits";
import { sortCustomerOrdersNewestFirst } from "@/lib/orders";
import { PageHeader } from "@/components/shared/page-header";
import { ACCOUNT_SUMMARY_MOCK } from "@/mocks/account";
import { CUSTOMER_ADDRESSES_MOCK } from "@/mocks/addresses";
import { CUSTOMER_BENEFITS_MOCK } from "@/mocks/benefits";
import { CUSTOMER_ORDERS_MOCK } from "@/mocks/orders";

export const metadata: Metadata = { title: "Mi cuenta" };

export default function AccountPage() {
  const [lastOrder] = sortCustomerOrdersNewestFirst(CUSTOMER_ORDERS_MOCK);
  const primaryAddress = getPrimaryCustomerAddress(CUSTOMER_ADDRESSES_MOCK);
  const featuredBenefit = getFeaturedCustomerBenefit(CUSTOMER_BENEFITS_MOCK);

  if (!lastOrder || !primaryAddress || !featuredBenefit) {
    return <EmptyState title="No pudimos mostrar toda tu información" description="Inténtalo nuevamente más tarde." />;
  }

  return (
    <div className="space-y-8">
      <PageHeader title="Mi cuenta" description="Revisa tu pedido más reciente, tus direcciones y beneficios." />
      <AccountSummary summary={ACCOUNT_SUMMARY_MOCK} lastOrder={lastOrder} primaryAddress={primaryAddress} featuredBenefit={featuredBenefit} />
    </div>
  );
}
