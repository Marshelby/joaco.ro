import { iniciarSesion } from "./actions";
import { GoogleLoginButton } from "@/components/auth/google-login-button";

export default function IniciarSesionPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  return <Login searchParams={searchParams} />;
}

async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  return <main className="mx-auto flex min-h-screen max-w-md items-center p-6"><div className="w-full space-y-5 rounded-xl border border-border bg-card p-6"><div><p className="text-sm text-muted-foreground">Hidro Leufú</p><h1 className="mt-1 text-2xl font-semibold">Ingresa a Hidro Leufú</h1></div>{params.error ? <p className="text-sm text-destructive">No fue posible iniciar sesión.</p> : null}<GoogleLoginButton /><div className="border-t pt-5"><p className="mb-3 text-sm text-muted-foreground">Acceso alternativo</p><form action={iniciarSesion} className="space-y-4"><label className="block text-sm font-medium">Correo<input required name="email" type="email" className="mt-2 h-11 w-full rounded-lg border border-input bg-background px-3" /></label><label className="block text-sm font-medium">Contraseña<input required name="password" type="password" className="mt-2 h-11 w-full rounded-lg border border-input bg-background px-3" /></label><button className="h-11 w-full rounded-lg border border-input px-4 font-semibold" type="submit">Entrar con correo</button></form></div></div></main>;
}
