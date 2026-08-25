import { KeyRound } from "lucide-react";

import { RecoveryLinkConfirmationForm } from "@/components/auth/recovery-link-confirmation-form";
import { ActionLink } from "@/components/ui/action-link";
import { hrefConReturnTo, obtenerReturnToAutenticacionSeguro } from "@/lib/account/return-to";

type ParametrosConfirmacionRecuperacion = { token_hash?: string; returnTo?: string };

const tokenHashValido = /^[A-Za-z0-9_-]{20,512}$/;

export default async function ConfirmarRecuperacionPage({ searchParams }: { searchParams: Promise<ParametrosConfirmacionRecuperacion> }) {
  const params = await searchParams;
  const returnTo = obtenerReturnToAutenticacionSeguro(params.returnTo) ?? null;
  const tokenHash = params.token_hash ?? "";
  const enlaceInvalido = !tokenHashValido.test(tokenHash);

  return (
    <section className="mx-auto flex min-h-[calc(100vh-12rem)] max-w-xl items-center px-4 py-10 sm:px-6 sm:py-16">
      <div className="w-full rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <KeyRound className="size-10 text-primary" aria-hidden="true" />
        <p className="mt-5 text-sm font-medium text-primary">Hidro Leufú</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-foreground">Crea una nueva contraseña</h1>
        {enlaceInvalido ? (
          <div className="mt-4 space-y-5">
            <p role="alert" className="text-base leading-7 text-destructive">El enlace de recuperación ya no es válido o expiró.</p>
            <ActionLink href={hrefConReturnTo("/recuperar-contrasena", returnTo)} variant="primary">Solicitar un nuevo enlace</ActionLink>
          </div>
        ) : (
          <div className="mt-5 space-y-6">
            <p className="text-base leading-7 text-muted-foreground">Confirma para verificar el enlace y continuar de forma segura.</p>
            <RecoveryLinkConfirmationForm tokenHash={tokenHash} returnTo={returnTo} />
          </div>
        )}
      </div>
    </section>
  );
}
