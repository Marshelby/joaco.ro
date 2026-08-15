import type { Metadata } from "next";
import { ROUTES } from "@/config/routes";
import { PageHeader } from "@/components/shared/page-header";
import { ActionLink } from "@/components/ui/action-link";
import { CustomerAddressForm } from "@/components/account/customer-address-form";
import { crearClienteSupabaseServidor } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Direcciones" };

export default async function NewCustomerAddressPage() {
  const supabase = await crearClienteSupabaseServidor();
  const { data: zonas } = await supabase.from("zonas_entrega").select("id,nombre").eq("activa", true).order("orden").order("nombre");
  return (
    <div className="space-y-8">
      <PageHeader title="Nueva dirección" description="Agrega un lugar de entrega para coordinar tus pedidos." actions={<ActionLink href={ROUTES.accountAddresses} variant="secondary">Volver a Mis direcciones</ActionLink>} />
      <CustomerAddressForm zonas={zonas ?? []} />
    </div>
  );
}
