import type { Metadata } from "next";
import { ROUTES } from "@/config/routes";
import { PageHeader } from "@/components/shared/page-header";
import { ActionLink } from "@/components/ui/action-link";
import { notFound } from "next/navigation";
import { CustomerAddressForm, type DireccionClienteFormulario } from "@/components/account/customer-address-form";
import { obtenerClienteActual } from "@/lib/account/identity";
import { crearClienteSupabaseServidor } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Direcciones" };

export default async function EditCustomerAddressPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cliente = await obtenerClienteActual();
  if (!cliente) notFound();
  const supabase = await crearClienteSupabaseServidor();
  const { data } = await supabase.from("direcciones_cliente").select("id,nombre,destinatario,telefono_contacto,direccion,comuna,region,referencia,es_principal").eq("id", id).eq("cliente_id", cliente.id).eq("activa", true).maybeSingle();
  if (!data) notFound();
  const direccion: DireccionClienteFormulario = { id: data.id, nombre: data.nombre, destinatario: data.destinatario, telefonoContacto: data.telefono_contacto, direccion: data.direccion, comuna: data.comuna, region: data.region, referencia: data.referencia, esPrincipal: data.es_principal };
  return (
    <div className="space-y-8">
      <PageHeader title="Editar dirección" description="Actualiza los datos de entrega que utilizas." actions={<ActionLink href={ROUTES.accountAddresses} variant="secondary">Volver a Mis direcciones</ActionLink>} />
      <CustomerAddressForm direccion={direccion} />
    </div>
  );
}
