import type { Metadata } from "next";
import { CheckCircle2, MapPin, Package, Phone, ShoppingBasket, UserRound } from "lucide-react";
import { Suspense } from "react";

import { CustomerProfileForm } from "@/components/account/customer-profile-form";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { AccountDashboardSkeleton } from "@/components/feedback/account-loading-skeletons";
import { ActionLink } from "@/components/ui/action-link";
import { PageHeader } from "@/components/shared/page-header";
import { ROUTES } from "@/config/routes";
import { obtenerCuentaDashboard } from "@/lib/account/account-dashboard";
import { crearClienteSupabaseServidor } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Mi cuenta" };

type DireccionDashboard = {
  id: string;
  nombre: string | null;
  destinatario: string | null;
  direccion: string;
  comuna: string;
  latitud: number | null;
  longitud: number | null;
  zonas_entrega: { nombre: string }[];
};

function tieneUbicacion(direccion: DireccionDashboard) {
  return Number.isFinite(direccion.latitud) && Number.isFinite(direccion.longitud);
}

export default function AccountPage() {
  return <Suspense fallback={<AccountDashboardSkeleton />}><AccountContent /></Suspense>;
}

async function AccountContent() {
  const cuenta = await obtenerCuentaDashboard();

  if (cuenta.estado === "admin") {
    return <div className="space-y-8"><PageHeader title="Mi cuenta" description="Sesión administrativa de Hidro Leufú." actions={<><ActionLink href={ROUTES.admin}>Ir a administración</ActionLink><SignOutButton /></>} /><section className="rounded-xl border border-border bg-card p-5 sm:p-6"><p className="text-sm text-muted-foreground">Identidad</p><p className="mt-1 break-all text-lg font-semibold text-foreground">{cuenta.nombreAdmin ?? cuenta.email ?? "Administrador"}</p><p className="mt-4 text-sm text-muted-foreground">Rol</p><p className="mt-1 font-medium text-foreground">Administrador</p></section></div>;
  }

  if (cuenta.estado === "inactive_customer") {
    return <div className="space-y-8"><PageHeader title="Mi cuenta" description="No pudimos habilitar las acciones de compra para esta cuenta." actions={<SignOutButton />} /><section className="rounded-xl border border-border bg-card p-5 sm:p-6"><h2 className="text-xl font-semibold tracking-tight text-foreground">Tu cuenta no está habilitada para realizar pedidos</h2><p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">Contacta a Hidro Leufú para revisar tu acceso. No creamos ni reactivamos cuentas automáticamente.</p></section></div>;
  }

  if (cuenta.estado !== "active_customer" || !cuenta.cliente) {
    return <div className="space-y-8"><PageHeader title="Mi cuenta" description="Revisa tu información de acceso." actions={<SignOutButton />} /><section className="rounded-xl border border-dashed border-border bg-card p-6 sm:p-8"><h2 className="text-xl font-semibold tracking-tight text-foreground">No pudimos cargar tu cuenta</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Intenta nuevamente. Si el problema continúa, contacta a Hidro Leufú.</p></section></div>;
  }

  const supabase = await crearClienteSupabaseServidor();
  const [{ data: direcciones }, { data: pedidos }] = await Promise.all([
    supabase.from("direcciones_cliente").select("id,nombre,destinatario,direccion,comuna,latitud,longitud,zonas_entrega(nombre)").eq("cliente_id", cuenta.cliente.id).eq("activa", true).order("es_principal", { ascending: false }).order("fecha_creacion", { ascending: true }),
    supabase.from("pedidos").select("id").eq("cliente_id", cuenta.cliente.id).order("fecha_creacion", { ascending: false }).limit(1),
  ]);
  const direccionesActivas = (direcciones as DireccionDashboard[] | null) ?? [];
  const direccionValida = direccionesActivas.find(tieneUbicacion) ?? null;
  const direccionSinUbicacion = direccionesActivas.find((direccion) => !tieneUbicacion(direccion)) ?? null;
  const tienePedidos = Boolean(pedidos?.[0]);

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader title={`Hola, ${cuenta.cliente.nombre}`} description="Administra tu cuenta y prepara tus próximos pedidos." actions={<SignOutButton />} />

      <section className="rounded-xl border border-primary/25 bg-primary/5 p-5 sm:p-6" aria-label="Estado de cuenta">
        <div className="flex gap-3"><CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" /><div><h2 className="font-semibold text-foreground">Tu cuenta está lista</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">Ya puedes guardar direcciones y realizar pedidos cuando quieras.</p></div></div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-card p-5 sm:p-6"><div className="flex gap-3"><MapPin className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" /><div className="min-w-0"><h2 className="font-semibold text-foreground">Dirección de entrega</h2>{direccionValida ? <><p className="mt-2 font-medium text-foreground">{direccionValida.destinatario ?? direccionValida.nombre ?? "Dirección de entrega"}</p><p className="mt-1 text-sm leading-6 text-muted-foreground">{direccionValida.direccion}<br />{direccionValida.zonas_entrega[0]?.nombre ?? direccionValida.comuna}</p></> : direccionSinUbicacion ? <><p className="mt-2 text-sm leading-6 text-muted-foreground">Completa la ubicación de tu dirección antes de usarla para pedidos.</p><ActionLink href={ROUTES.editCustomerAddress(direccionSinUbicacion.id)} className="mt-4">Actualizar dirección</ActionLink></> : <><p className="mt-2 text-sm leading-6 text-muted-foreground">Necesitarás una dirección para finalizar tus pedidos.</p><ActionLink href={ROUTES.newCustomerAddress} className="mt-4">Agregar dirección de entrega</ActionLink></>}</div></div>{direccionValida ? <ActionLink href={ROUTES.accountAddresses} variant="secondary" className="mt-5">Gestionar direcciones</ActionLink> : null}</section>

        <section className="rounded-xl border border-border bg-card p-5 sm:p-6"><div className="flex gap-3"><Package className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" /><div><h2 className="font-semibold text-foreground">Pedidos</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{tienePedidos ? "Revisa el estado y detalle de tus pedidos." : "Aún no tienes pedidos."}</p></div></div><div className="mt-5 flex flex-wrap gap-3"><ActionLink href={ROUTES.accountOrders} variant={tienePedidos ? "primary" : "secondary"}>Mis pedidos</ActionLink>{!tienePedidos ? <ActionLink href={ROUTES.home}>Ver productos</ActionLink> : null}</div></section>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <CustomerProfileForm nombre={cuenta.cliente.nombre} telefono={cuenta.cliente.telefono} email={cuenta.email ?? cuenta.cliente.email} />
        <section className="rounded-xl border border-border bg-card p-5 sm:p-6"><div className="flex gap-3"><UserRound className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" /><div><h2 className="font-semibold text-foreground">Accesos rápidos</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Encuentra lo que necesitas para seguir comprando.</p></div></div><div className="mt-5 grid gap-3 sm:grid-cols-2"><ActionLink href={ROUTES.home}><ShoppingBasket className="mr-2 size-4" aria-hidden="true" />Explorar productos</ActionLink><ActionLink href={ROUTES.accountAddresses} variant="secondary"><MapPin className="mr-2 size-4" aria-hidden="true" />Mis direcciones</ActionLink><ActionLink href={ROUTES.accountOrders} variant="secondary"><Package className="mr-2 size-4" aria-hidden="true" />Mis pedidos</ActionLink>{!cuenta.cliente.telefono ? <a href="#datos-de-contacto" className="inline-flex min-h-11 items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"><Phone className="mr-2 size-4" aria-hidden="true" />Agregar teléfono</a> : null}</div></section>
      </div>
    </div>
  );
}
