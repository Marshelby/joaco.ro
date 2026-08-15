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
  const [{ data }, { data: zonas }] = await Promise.all([
    supabase.from("direcciones_cliente").select("id,nombre,destinatario,telefono_contacto,direccion,comuna,referencia,es_principal,zona_entrega_id,latitud,longitud").eq("id", id).eq("cliente_id", cliente.id).eq("activa", true).maybeSingle(),
    supabase.from("zonas_entrega").select("id,nombre,comuna_base").eq("activa", true).order("orden").order("nombre"),
  ]);
  if (!data) notFound();
  const coincidenciasLegacy = (zonas ?? []).filter((zona) => zona.nombre === data.comuna || zona.comuna_base === data.comuna);
  const zonaEntregaId = data.zona_entrega_id ?? (coincidenciasLegacy.length === 1 ? coincidenciasLegacy[0].id : null);
  const direccion: DireccionClienteFormulario = { id: data.id, destinatario: data.destinatario ?? data.nombre, telefonoContacto: data.telefono_contacto, direccion: data.direccion, zonaEntregaId, referencia: data.referencia, esPrincipal: data.es_principal, latitud: data.latitud === null ? null : Number(data.latitud), longitud: data.longitud === null ? null : Number(data.longitud) };
  return (
    <div className="space-y-8">
      <PageHeader title="Editar dirección" description="Actualiza los datos de entrega que utilizas." actions={<ActionLink href={ROUTES.accountAddresses} variant="secondary">Volver a Mis direcciones</ActionLink>} />
      <CustomerAddressForm direccion={direccion} zonas={zonas ?? []} />
    </div>
  );
}
