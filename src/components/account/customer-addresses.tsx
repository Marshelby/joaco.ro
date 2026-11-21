import { notFound } from "next/navigation";
import { MapPin, Pencil, Phone, Plus, StickyNote } from "lucide-react";

import { AddressDeactivateAction } from "@/components/account/address-deactivate-action";
import { AddressEditor, AddressEditorTrigger } from "@/components/account/address-editor";
import type { DireccionClienteFormulario } from "@/components/account/customer-address-form";
import { EmptyState } from "@/components/feedback/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { ActionLink } from "@/components/ui/action-link";
import { obtenerClienteActual } from "@/lib/account/identity";
import { etiquetaReturnTo, type ReturnToCompra } from "@/lib/account/return-to";
import { crearClienteSupabaseServidor } from "@/lib/supabase/server";

type DireccionFila = { id: string; nombre: string | null; destinatario: string | null; telefono_contacto: string | null; direccion: string; comuna: string; zona_entrega_id: string | null; referencia: string | null; es_principal: boolean; latitud: number | null; longitud: number | null; zonas_entrega: { nombre: string }[] };

export async function CustomerAddresses({ returnTo, initialEditor }: { returnTo: ReturnToCompra | null; initialEditor?: string | null }) {
  const cliente = await obtenerClienteActual();
  if (!cliente) {
    if (initialEditor) notFound();
    return <EmptyState title="No tienes una cuenta de cliente activa" description="No podemos mostrar direcciones para esta cuenta." />;
  }

  const supabase = await crearClienteSupabaseServidor();
  const [{ data: direcciones, error }, { data: zonas, error: errorZonas }] = await Promise.all([
    supabase.from("direcciones_cliente")
      .select("id,nombre,destinatario,telefono_contacto,direccion,comuna,zona_entrega_id,referencia,es_principal,latitud,longitud,zonas_entrega(nombre)")
      .eq("cliente_id", cliente.id)
      .eq("ambito", "personal").eq("activa", true)
      .order("es_principal", { ascending: false })
      .order("fecha_creacion", { ascending: true }),
    supabase.from("zonas_entrega").select("id,nombre,comuna_base").eq("activa", true).order("orden").order("nombre"),
  ]);
  const addresses = (direcciones ?? []) as DireccionFila[];

  function formAddress(address: DireccionFila): DireccionClienteFormulario {
    const coincidencias = (zonas ?? []).filter((zona) => zona.nombre === address.comuna || zona.comuna_base === address.comuna);
    return {
      id: address.id,
      destinatario: address.destinatario ?? address.nombre,
      telefonoContacto: address.telefono_contacto,
      direccion: address.direccion,
      zonaEntregaId: address.zona_entrega_id ?? (coincidencias.length === 1 ? coincidencias[0].id : null),
      referencia: address.referencia,
      esPrincipal: address.es_principal,
      latitud: address.latitud === null ? null : Number(address.latitud),
      longitud: address.longitud === null ? null : Number(address.longitud),
    };
  }

  const initialAddress = typeof initialEditor === "string"
    ? addresses.find((address) => address.id === initialEditor)
    : undefined;
  if (typeof initialEditor === "string" && !initialAddress) notFound();

  return (
    <AddressEditor zonas={zonas ?? []} errorZonas={Boolean(errorZonas)} returnTo={returnTo} initialOpen={initialEditor !== undefined} initialAddress={initialAddress ? formAddress(initialAddress) : undefined}>
      <div className="space-y-6">
        <PageHeader
          title="Mis direcciones"
          description="Revisa las direcciones que utilizas para recibir tus pedidos."
          className="pb-5 sm:items-center"
          actions={
            <div className="flex flex-wrap items-center gap-2">
              {returnTo && <ActionLink href={returnTo} variant="secondary">{etiquetaReturnTo(returnTo)}</ActionLink>}
              <AddressEditorTrigger className="gap-2">
                <Plus aria-hidden="true" className="size-4" />
                Nueva dirección
              </AddressEditorTrigger>
            </div>
          }
        />
        {error ? (
          <EmptyState title="No pudimos cargar tus direcciones" description="Inténtalo nuevamente más tarde." />
        ) : addresses.length > 0 ? (
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,22rem),1fr))] gap-4" aria-label="Direcciones guardadas">
            {addresses.map((address) => {
              const hasLocation = Number.isFinite(address.latitud) && Number.isFinite(address.longitud);

              return (
                <li key={address.id} className="min-w-0">
                  <article aria-labelledby={`address-${address.id}`} className="flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                    <header className="flex items-center justify-between gap-3 border-b border-border/70 bg-primary/[0.03] px-4 py-2.5 sm:px-5">
                      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                        <h2 id={`address-${address.id}`} className="min-w-0 break-words text-sm font-semibold text-foreground">
                          {address.destinatario ?? address.nombre ?? "Dirección"}
                        </h2>
                        {address.es_principal ? (
                          <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-secondary-foreground">Principal</span>
                        ) : null}
                      </div>
                      <AddressEditorTrigger
                        direccion={formAddress(address)}
                        variant="secondary"
                        className="min-h-9 shrink-0 gap-1.5 px-2.5"
                      >
                        <Pencil aria-hidden="true" className="size-3.5" />
                        Editar
                      </AddressEditorTrigger>
                    </header>

                    <div className="flex-1 space-y-3 px-4 py-3 sm:px-5">
                      <address className="space-y-0.5 break-words not-italic">
                        <p className="text-base font-semibold leading-snug tracking-tight text-foreground">{address.direccion}</p>
                        <p className="text-sm text-muted-foreground">{address.zonas_entrega[0]?.nombre ?? address.comuna}</p>
                      </address>

                      <dl className="space-y-1.5 text-sm leading-5 text-muted-foreground">
                        <div className="flex items-start gap-2">
                          <dt><Phone aria-hidden="true" className="mt-0.5 size-4" /><span className="sr-only">Teléfono</span></dt>
                          <dd className="min-w-0 break-words">{address.telefono_contacto ?? "Sin teléfono registrado"}</dd>
                        </div>
                        {address.referencia ? (
                          <div className="flex items-start gap-2">
                            <dt><StickyNote aria-hidden="true" className="mt-0.5 size-4" /><span className="sr-only">Referencia</span></dt>
                            <dd className="min-w-0 break-words">{address.referencia}</dd>
                          </div>
                        ) : null}
                        <div className={`flex items-start gap-2 ${hasLocation ? "text-primary" : "text-amber-700 dark:text-amber-300"}`}>
                          <dt><MapPin aria-hidden="true" className="mt-0.5 size-4" /><span className="sr-only">Estado de ubicación</span></dt>
                          <dd>{hasLocation ? "Ubicación marcada" : "Falta marcar ubicación"}</dd>
                        </div>
                      </dl>
                    </div>

                    <footer className="border-t border-border/70 px-4 py-1.5 sm:px-5">
                      <AddressDeactivateAction direccionId={address.id} />
                    </footer>
                  </article>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState
            title="Aún no tienes direcciones"
            description="Cuando tengas una dirección guardada, aparecerá aquí."
            action={<AddressEditorTrigger>Agregar dirección</AddressEditorTrigger>}
          />
        )}
      </div>
    </AddressEditor>
  );
}
