import { KeyRound } from "lucide-react";

import { UpdatePasswordForm } from "@/components/auth/update-password-form";
import { ActionLink } from "@/components/ui/action-link";
import { hrefConReturnTo, obtenerReturnToAutenticacionSeguro } from "@/lib/account/return-to";
import { crearClienteSupabaseServidor } from "@/lib/supabase/server";

type ParametrosActualizarContrasena = { returnTo?: string; estado?: string };

export default async function ActualizarContrasenaPage({ searchParams }: { searchParams: Promise<ParametrosActualizarContrasena> }) {
  const params = await searchParams;
  const returnTo = obtenerReturnToAutenticacionSeguro(params.returnTo) ?? null;
  const supabase = await crearClienteSupabaseServidor();
  const { data: { user }, error } = await supabase.auth.getUser();
  const enlaceInvalido = params.estado === "invalido" || error || !user;

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
          <div className="mt-7"><UpdatePasswordForm returnTo={returnTo} /></div>
        )}
      </div>
    </section>
  );
}
