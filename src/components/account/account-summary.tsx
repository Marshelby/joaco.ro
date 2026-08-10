import { ArrowUpRight, Gift, MapPin, Package } from "lucide-react";
import Link from "next/link";

import { ROUTES } from "@/config/routes";
import { formatCustomerAddressStreet, getCustomerAddressTypeLabel } from "@/lib/addresses";
import { formatCLP, formatDateCL } from "@/lib/formatters";
import type { AccountSummaryMock, CustomerAddressMock, CustomerBenefitMock, CustomerOrderMock } from "@/types/account";

import { OrderStatusBadge } from "./order-status-badge";

type AccountSummaryProps = {
  summary: AccountSummaryMock;
  lastOrder: CustomerOrderMock;
  primaryAddress: CustomerAddressMock;
  featuredBenefit: CustomerBenefitMock;
};

export function AccountSummary({ summary, lastOrder, primaryAddress, featuredBenefit }: AccountSummaryProps) {
  const { profile } = summary;

  return (
    <div className="space-y-10 sm:space-y-12">
      <section aria-labelledby="profile-title" className="border-b border-border pb-8 sm:pb-10">
        <div className="flex items-center gap-4">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-secondary text-base font-semibold tracking-wide text-secondary-foreground" aria-hidden="true">
            {profile.avatarInitials}
          </div>
          <div className="min-w-0">
            <h2 id="profile-title" className="truncate text-xl font-semibold tracking-tight text-foreground sm:text-2xl">{profile.name}</h2>
            <p className="mt-1 text-sm text-muted-foreground">Cliente Hidro Leufú</p>
          </div>
        </div>
        <dl className="mt-7 grid gap-5 text-sm sm:grid-cols-3">
          <div className="space-y-1">
            <dt className="text-muted-foreground">Correo electrónico</dt>
            <dd className="break-all font-medium text-foreground">{profile.googleEmail}</dd>
          </div>
          <div className="space-y-1">
            <dt className="text-muted-foreground">Teléfono</dt>
            <dd className="font-medium text-foreground">{profile.phone}</dd>
          </div>
          <div className="space-y-1">
            <dt className="text-muted-foreground">Comuna</dt>
            <dd className="font-medium text-foreground">{profile.commune}</dd>
          </div>
        </dl>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section aria-labelledby="last-order-title" className="rounded-xl border border-border bg-card p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Package className="size-4" aria-hidden="true" />
                <p className="text-sm font-medium">Último pedido</p>
              </div>
              <h2 id="last-order-title" className="mt-4 text-lg font-semibold tracking-tight text-foreground">Pedido #{lastOrder.number}</h2>
            </div>
            <OrderStatusBadge status={lastOrder.status} />
          </div>
          <dl className="mt-6 grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-muted-foreground">Fecha</dt>
              <dd className="mt-1 font-medium text-foreground">{formatDateCL(lastOrder.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Total</dt>
              <dd className="mt-1 font-semibold text-foreground">{formatCLP(lastOrder.total)}</dd>
            </div>
          </dl>
          <Link href={ROUTES.accountOrders} className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-semibold text-primary outline-none transition-colors hover:text-primary/75 focus-visible:ring-3 focus-visible:ring-ring/50">
            Ver historial
            <ArrowUpRight className="size-4" aria-hidden="true" />
          </Link>
        </section>

        <section aria-labelledby="address-title" className="rounded-xl border border-border bg-card p-5 sm:p-6">
          <div className="flex items-center gap-2 text-muted-foreground">
            <MapPin className="size-4" aria-hidden="true" />
            <p className="text-sm font-medium">Dirección principal</p>
          </div>
          <h2 id="address-title" className="mt-4 text-lg font-semibold tracking-tight text-foreground">{formatCustomerAddressStreet(primaryAddress)}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{primaryAddress.commune}, {primaryAddress.region} · {getCustomerAddressTypeLabel(primaryAddress.type)}</p>
        </section>
      </div>

      <section aria-labelledby="benefit-title" className="rounded-xl border border-border bg-secondary/45 p-5 sm:p-6">
        <div className="flex gap-3">
          <Gift className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden="true" />
          <div>
            <h2 id="benefit-title" className="text-lg font-semibold tracking-tight text-foreground">Beneficios Hidro Leufú</h2>
            <p className="mt-2 font-medium text-foreground">{featuredBenefit.title}</p>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{featuredBenefit.eligibilityText}</p>
            <Link href={ROUTES.accountBenefits} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-semibold text-primary outline-none transition-colors hover:text-primary/75 focus-visible:ring-3 focus-visible:ring-ring/50">
              Ver beneficios
              <ArrowUpRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

    </div>
  );
}
