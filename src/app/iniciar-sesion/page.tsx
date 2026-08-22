import Link from "next/link";

import { LoginAuthOptions } from "@/components/auth/login-auth-options";
import { ROUTES } from "@/config/routes";
import { hrefConReturnTo, obtenerReturnToAutenticacionSeguro, obtenerReturnToSeguro } from "@/lib/account/return-to";

type ParametrosInicioSesion = { error?: string; modo?: string; returnTo?: string };

export default function IniciarSesionPage({ searchParams }: { searchParams: Promise<ParametrosInicioSesion> }) {
  return <Login searchParams={searchParams} />;
}

function hrefModo(modo: "iniciar" | "crear", returnTo: string | null) {
  return hrefConReturnTo(`/iniciar-sesion?modo=${modo}`, returnTo);
}

async function Login({ searchParams }: { searchParams: Promise<ParametrosInicioSesion> }) {
  const params = await searchParams;
  const modo = params.modo === "crear" ? "crear" : "iniciar";
  const returnTo = obtenerReturnToAutenticacionSeguro(params.returnTo) ?? null;
  const vieneDesdeCompra = obtenerReturnToSeguro(params.returnTo) !== null;
  const error = params.error === "cuenta"
    ? "No pudimos habilitar tu cuenta. Contacta a Hidro Leufú."
      : params.error === "oauth"
        ? "No fue posible iniciar sesión con Google. Intenta nuevamente."
        : params.error === "registro"
          ? "No fue posible crear la cuenta. Revisa tus datos e inténtalo nuevamente."
          : params.error === "verificacion"
            ? "No pudimos verificar el acceso. Intenta nuevamente."
          : null;
  const creando = modo === "crear";

  return <main className="mx-auto flex min-h-screen max-w-md items-center p-6"><div className="w-full space-y-5 rounded-xl border border-border bg-card p-6 sm:p-7"><div><p className="text-sm text-muted-foreground">Hidro Leufú</p><h1 className="mt-1 text-2xl font-semibold">Bienvenido a Hidro Leufú</h1><p className="mt-2 text-sm text-muted-foreground">{creando ? "Crea tu cuenta para comprar de forma más simple." : "Ingresa para revisar y realizar tus pedidos."}</p></div><div className="grid grid-cols-2 rounded-lg bg-muted p-1 text-sm font-medium"><Link href={hrefModo("iniciar", returnTo)} className={`rounded-md px-3 py-2 text-center ${!creando ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}>Iniciar sesión</Link><Link href={hrefModo("crear", returnTo)} className={`rounded-md px-3 py-2 text-center ${creando ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}>Crear cuenta</Link></div>{error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}<LoginAuthOptions modo={modo} returnTo={returnTo} /><Link href={vieneDesdeCompra ? ROUTES.cart : ROUTES.home} className="inline-flex min-h-11 items-center rounded-lg text-sm font-semibold text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50">← {vieneDesdeCompra ? "Volver al carrito" : "Volver a Hidro Leufú"}</Link></div></main>;
}
