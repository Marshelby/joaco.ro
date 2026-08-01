import type { Metadata } from "next";
import { ROUTES } from "@/config/routes";
import { PageHeader } from "@/components/shared/page-header";
import { ActionLink } from "@/components/ui/action-link";

export const metadata: Metadata = { title: "Direcciones" };

export default function NewCustomerAddressPage() {
  return (
    <div className="space-y-8">
      <PageHeader title="Direcciones" description="Revisa la información que utilizas para recibir tus pedidos." />
      <section className="rounded-xl border border-border bg-card p-5 sm:p-6" aria-labelledby="address-form-title">
        <h2 id="address-form-title" className="text-lg font-semibold tracking-tight text-foreground">Mis direcciones</h2>
        <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">Vuelve a Mis direcciones para revisar tus datos de entrega.</p>
        <ActionLink href={ROUTES.accountAddresses} variant="secondary" className="mt-5">Volver a Mis direcciones</ActionLink>
      </section>
    </div>
  );
}
