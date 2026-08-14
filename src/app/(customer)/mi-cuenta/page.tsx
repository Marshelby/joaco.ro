import type { Metadata } from "next";

import { CustomerProfileForm } from "@/components/account/customer-profile-form";
import { EmptyState } from "@/components/feedback/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { ActionLink } from "@/components/ui/action-link";
import { ROUTES } from "@/config/routes";
import { obtenerClienteActual, obtenerIdentidadActual } from "@/lib/account/identity";

export const metadata: Metadata = { title: "Mi cuenta" };

export default async function AccountPage() {
  const [identidad, cliente] = await Promise.all([obtenerIdentidadActual(), obtenerClienteActual()]);
  if (!identidad) return null;

  if (identidad.rol === "admin") {
    return <div className="space-y-8"><PageHeader title="Mi cuenta" description="Sesión administrativa de Hidro Leufú." actions={<ActionLink href={ROUTES.admin}>Ir a administración</ActionLink>} /><section className="rounded-xl border border-border bg-card p-5 sm:p-6"><p className="text-sm text-muted-foreground">Identidad</p><p className="mt-1 break-all text-lg font-semibold text-foreground">{identidad.nombreMostrado}</p><p className="mt-4 text-sm text-muted-foreground">Rol</p><p className="mt-1 font-medium text-foreground">Administrador</p></section></div>;
  }

  if (!cliente) return <EmptyState title="No tienes una cuenta de cliente activa" description="Comunícate con Hidro Leufú para revisar tu acceso." />;

  return (
    <div className="space-y-8">
      <PageHeader title="Mi cuenta" description="Revisa y actualiza tus datos de contacto." />
      <CustomerProfileForm nombre={cliente.nombre} telefono={cliente.telefono} email={cliente.email ?? identidad.email} />
    </div>
  );
}
