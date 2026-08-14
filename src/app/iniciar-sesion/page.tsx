import { iniciarSesion } from "./actions";
import { EmailLoginForm } from "@/components/auth/email-login-form";
import { GoogleLoginButton } from "@/components/auth/google-login-button";

export default function IniciarSesionPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  return <Login searchParams={searchParams} />;
}

async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  return <main className="mx-auto flex min-h-screen max-w-md items-center p-6"><div className="w-full space-y-5 rounded-xl border border-border bg-card p-6"><div><p className="text-sm text-muted-foreground">Hidro Leufú</p><h1 className="mt-1 text-2xl font-semibold">Ingresa a Hidro Leufú</h1></div>{params.error ? <p className="text-sm text-destructive">No fue posible iniciar sesión.</p> : null}<GoogleLoginButton /><div className="border-t pt-5"><p className="mb-3 text-sm text-muted-foreground">Acceso alternativo</p><EmailLoginForm action={iniciarSesion} /></div></div></main>;
}
