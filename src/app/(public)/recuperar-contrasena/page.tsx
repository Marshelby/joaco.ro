import { KeyRound } from "lucide-react";

import { PasswordRecoveryForm } from "@/components/auth/password-recovery-form";
import { ActionLink } from "@/components/ui/action-link";
import { hrefConReturnTo, obtenerReturnToAutenticacionSeguro } from "@/lib/account/return-to";

type ParametrosRecuperacion = { returnTo?: string };

export default async function RecuperarContrasenaPage({ searchParams }: { searchParams: Promise<ParametrosRecuperacion> }) {
  const params = await searchParams;
  const returnTo = obtenerReturnToAutenticacionSeguro(params.returnTo) ?? null;

  return (
    <section className="mx-auto flex min-h-[calc(100vh-12rem)] max-w-xl items-center px-4 py-10 sm:px-6 sm:py-16">
      <div className="w-full rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <KeyRound className="size-10 text-primary" aria-hidden="true" />
        <p className="mt-5 text-sm font-medium text-primary">Hidro Leufú</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-foreground">Recupera tu acceso</h1>
        <p className="mt-4 text-base leading-7 text-muted-foreground">Ingresa tu correo y te enviaremos un enlace para crear una nueva contraseña.</p>
        <div className="mt-7"><PasswordRecoveryForm returnTo={returnTo} /></div>
        <div className="mt-5"><ActionLink href={hrefConReturnTo("/iniciar-sesion", returnTo)} variant="quiet">← Volver a iniciar sesión</ActionLink></div>
      </div>
    </section>
  );
}
