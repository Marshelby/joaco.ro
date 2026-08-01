import type { Metadata } from "next";
import { AddressCard } from "@/components/account/address-card";
import { EmptyState } from "@/components/feedback/empty-state";
import { sortCustomerAddresses } from "@/lib/addresses";
import { CUSTOMER_ADDRESSES_MOCK } from "@/mocks/addresses";
import { PageHeader } from "@/components/shared/page-header";

export const metadata: Metadata = { title: "Mis direcciones" };

export default function CustomerAddressesPage() {
  const addresses = sortCustomerAddresses(CUSTOMER_ADDRESSES_MOCK.filter((address) => address.isActive));

  return (
    <div className="space-y-8">
      <PageHeader title="Mis direcciones" description="Revisa las direcciones que utilizas para recibir tus pedidos." />
      {addresses.length > 0 ? <div className="space-y-4" aria-label="Direcciones guardadas">{addresses.map((address) => <AddressCard key={address.id} address={address} />)}</div> : <EmptyState title="Aún no tienes direcciones" description="Cuando tengas una dirección guardada, aparecerá aquí." />}
    </div>
  );
}
