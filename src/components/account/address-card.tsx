import { MapPin } from "lucide-react";
import { formatCustomerAddressStreet, getCustomerAddressTypeLabel } from "@/lib/addresses";
import type { CustomerAddressMock } from "@/types/account";

export function AddressCard({ address }: { address: CustomerAddressMock }) {
  return (
    <article className="rounded-xl border border-border bg-card p-5 sm:p-6" aria-labelledby={`address-${address.id}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <MapPin className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <h2 id={`address-${address.id}`} className="text-lg font-semibold tracking-tight text-foreground">{address.label}</h2>
          <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">{getCustomerAddressTypeLabel(address.type)}</span>
          {address.isPrimary ? <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-secondary-foreground">Principal</span> : null}
        </div>
      </div>

      <address className="mt-5 not-italic">
        <p className="font-medium text-foreground">{formatCustomerAddressStreet(address)}</p>
        <p className="mt-1 text-sm text-muted-foreground">{address.commune}, {address.region}</p>
      </address>

      {address.reference ? <div className="mt-5 text-sm"><p className="text-muted-foreground">Referencia</p><p className="mt-1 leading-6 text-foreground">{address.reference}</p></div> : null}

      <dl className="mt-5 text-sm"><dt className="text-muted-foreground">Recibe</dt><dd className="mt-1 font-medium leading-6 text-foreground">{address.recipientName}<br />{address.phone}</dd></dl>

    </article>
  );
}
