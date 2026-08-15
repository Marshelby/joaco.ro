import type { Metadata } from "next";
import { MapPin } from "lucide-react";
import { AddressDeactivateAction } from "@/components/account/address-deactivate-action";
import { EmptyState } from "@/components/feedback/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { ActionLink } from "@/components/ui/action-link";
import { ROUTES } from "@/config/routes";
import { obtenerClienteActual } from "@/lib/account/identity";
import { crearClienteSupabaseServidor } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Mis direcciones" };

type DireccionFila = { id: string; nombre: string | null; destinatario: string | null; telefono_contacto: string | null; direccion: string; comuna: string; referencia: string | null; es_principal: boolean; latitud: number | null; longitud: number | null; zonas_entrega: { nombre: string }[] };

export default async function CustomerAddressesPage() {
  const cliente = await obtenerClienteActual();
  if (!cliente) return <EmptyState title="No tienes una cuenta de cliente activa" description="No podemos mostrar direcciones para esta cuenta." />;

  const supabase = await crearClienteSupabaseServidor();
  const { data: direcciones, error } = await supabase
    .from("direcciones_cliente")
    .select("id,nombre,destinatario,telefono_contacto,direccion,comuna,referencia,es_principal,latitud,longitud,zonas_entrega(nombre)")
    .eq("cliente_id", cliente.id)
    .eq("activa", true)
    .order("es_principal", { ascending: false })
    .order("fecha_creacion", { ascending: true });
  const addresses = (direcciones ?? []) as DireccionFila[];

  return (
    <div className="space-y-8">
      <PageHeader title="Mis direcciones" description="Revisa las direcciones que utilizas para recibir tus pedidos." actions={<ActionLink href={ROUTES.newCustomerAddress}>Nueva dirección</ActionLink>} />
      {error ? <EmptyState title="No pudimos cargar tus direcciones" description="Inténtalo nuevamente más tarde." /> : addresses.length > 0 ? <div className="space-y-4" aria-label="Direcciones guardadas">{addresses.map((address) => { const hasLocation = Number.isFinite(address.latitud) && Number.isFinite(address.longitud); return <article key={address.id} className="rounded-xl border border-border bg-card p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-semibold tracking-tight text-foreground">{address.destinatario ?? address.nombre ?? "Dirección"}</h2>{address.es_principal ? <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-secondary-foreground">Principal</span> : null}</div><address className="mt-4 not-italic"><p className="font-medium text-foreground">{address.direccion}</p><p className="mt-1 text-sm text-muted-foreground">{address.zonas_entrega[0]?.nombre ?? address.comuna}</p></address></div><ActionLink href={ROUTES.editCustomerAddress(address.id)} variant="secondary">Editar</ActionLink></div><dl className="mt-5 text-sm"><dt className="text-muted-foreground">Teléfono</dt><dd className="mt-1 font-medium text-foreground">{address.telefono_contacto ?? "Sin teléfono registrado"}</dd></dl><p className={`mt-4 flex items-center gap-1.5 text-sm ${hasLocation ? "text-primary" : "text-amber-700 dark:text-amber-300"}`}><MapPin aria-hidden="true" className="size-4" /> {hasLocation ? "Ubicación marcada" : "Falta marcar ubicación"}</p>{address.referencia ? <div className="mt-5 text-sm"><p className="text-muted-foreground">Referencia</p><p className="mt-1 leading-6 text-foreground">{address.referencia}</p></div> : null}<div className="mt-5 border-t border-border pt-3"><AddressDeactivateAction direccionId={address.id} /></div></article>; })}</div> : <EmptyState title="Aún no tienes direcciones" description="Cuando tengas una dirección guardada, aparecerá aquí." action={<ActionLink href={ROUTES.newCustomerAddress}>Agregar dirección</ActionLink>} />}
    </div>
  );
}
