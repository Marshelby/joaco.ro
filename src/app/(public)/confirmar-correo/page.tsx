import { MailCheck } from "lucide-react";

import { ActionLink } from "@/components/ui/action-link";
import { hrefConReturnTo, obtenerReturnToAutenticacionSeguro } from "@/lib/account/return-to";
import { obtenerCorreoEnmascaradoSeguro } from "@/lib/auth/email-confirmation";

type ParametrosConfirmacionCorreo = { correo?: string; gmail?: string; returnTo?: string };

export default async function ConfirmarCorreoPage({ searchParams }: { searchParams: Promise<ParametrosConfirmacionCorreo> }) {
  const params = await searchParams;
  const correo = obtenerCorreoEnmascaradoSeguro(params.correo);
  const returnTo = obtenerReturnToAutenticacionSeguro(params.returnTo) ?? null;
  const mostrarGmail = correo !== null && params.gmail === "1";

  return (
    <section className="mx-auto flex min-h-[calc(100vh-12rem)] max-w-xl items-center px-4 py-10 sm:px-6 sm:py-16">
      <div className="w-full rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <MailCheck className="size-10 text-primary" aria-hidden="true" />
        <p className="mt-5 text-sm font-medium text-primary">Hidro Leufú</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-foreground">¡Revisa tu correo!</h1>
        <p className="mt-4 text-base leading-7 text-foreground">Tu cuenta fue creada correctamente.</p>
        {correo ? <p className="mt-2 text-sm leading-6 text-muted-foreground">Te enviamos un enlace de confirmación a <span className="font-medium text-foreground">{correo}</span> para activar tu cuenta.</p> : <p className="mt-2 text-sm leading-6 text-muted-foreground">Revisa tu correo para confirmar tu cuenta y continuar.</p>}
        <p className="mt-5 text-sm leading-6 text-muted-foreground">¿No encuentras el mensaje? Revisa Spam o Promociones.</p>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          {mostrarGmail ? <a href="https://mail.google.com/" target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground outline-none transition-colors hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50">Abrir Gmail</a> : null}
          <ActionLink href={hrefConReturnTo("/iniciar-sesion", returnTo)} variant={mostrarGmail ? "secondary" : "primary"}>Volver a iniciar sesión</ActionLink>
        </div>
        <p className="mt-6 text-sm leading-6 text-muted-foreground">Al confirmar, volverás automáticamente a Hidro Leufú.</p>
      </div>
    </section>
  );
}
