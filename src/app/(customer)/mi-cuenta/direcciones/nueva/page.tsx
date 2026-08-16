import type { Metadata } from "next";
import { ROUTES } from "@/config/routes";
import { PageHeader } from "@/components/shared/page-header";
import { ActionLink } from "@/components/ui/action-link";
import { CustomerAddressForm } from "@/components/account/customer-address-form";
import { crearClienteSupabaseServidor } from "@/lib/supabase/server";
import { hrefConReturnTo, obtenerReturnToSeguro } from "@/lib/account/return-to";

export const metadata: Metadata = { title: "Direcciones" };

export default async function NewCustomerAddressPage({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  const { returnTo: returnToParametro } = await searchParams;
  const returnTo = obtenerReturnToSeguro(returnToParametro);
  const supabase = await crearClienteSupabaseServidor();
  const { data: zonas } = await supabase.from("zonas_entrega").select("id,nombre").eq("activa", true).order("orden").order("nombre");
  return (
    <div className="space-y-8">
      <PageHeader title="Nueva dirección" description="Agrega un lugar de entrega para coordinar tus pedidos." actions={<ActionLink href={hrefConReturnTo(ROUTES.accountAddresses, returnTo)} variant="secondary">Volver a Mis direcciones</ActionLink>} />
      <CustomerAddressForm zonas={zonas ?? []} returnTo={returnTo} />
    </div>
  );
}
