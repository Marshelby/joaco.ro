import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { InvitationAcceptanceAction } from "@/components/account/invitation-acceptance-action";
import { Container } from "@/components/layout/container";
import { ActionLink } from "@/components/ui/action-link";
import { ROUTES } from "@/config/routes";
import { hrefAceptarInvitacion, hrefConReturnTo, obtenerTokenInvitacionSeguro } from "@/lib/account/return-to";
import { crearClienteSupabaseServidor } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Aceptar invitación" };

export default async function AcceptCustomerInvitationPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token: tokenSinValidar } = await searchParams;
  const token = obtenerTokenInvitacionSeguro(tokenSinValidar);
  if (!token) return <Container className="py-10 sm:py-16"><section className="mx-auto max-w-lg rounded-xl border border-border bg-card p-6 sm:p-8"><h1 className="text-2xl font-semibold tracking-tight text-foreground">Enlace de invitación no válido</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">Solicita un nuevo enlace a la persona administradora de Hidro Leufú.</p><ActionLink href={ROUTES.home} className="mt-6" variant="secondary">Ir a Hidro Leufú</ActionLink></section></Container>;
  const supabase = await crearClienteSupabaseServidor();
  const { data: sesion } = await supabase.auth.getUser();
  if (!sesion.user) redirect(hrefConReturnTo("/iniciar-sesion", hrefAceptarInvitacion(token)));
  return <Container className="py-10 sm:py-16"><section className="mx-auto max-w-lg rounded-xl border border-border bg-card p-6 sm:p-8"><p className="text-sm font-medium text-primary">Acceso web de cliente</p><h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">Vincula tu cuenta</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">Esta invitación vinculará tu cuenta autenticada con un cliente existente de Hidro Leufú. Verificaremos que el correo de tu cuenta coincida con el correo autorizado.</p><p className="mt-3 break-all text-sm text-muted-foreground">Sesión actual: {sesion.user.email ?? "sin correo"}</p><div className="mt-6"><InvitationAcceptanceAction token={token} /></div></section></Container>;
}
