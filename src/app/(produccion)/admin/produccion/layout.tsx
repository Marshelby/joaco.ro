import type { ReactNode } from "react";
import Link from "next/link";
import { Logo } from "@/components/shared/logo";
import { NavigationLink } from "@/components/navigation/navigation-link";
import { administradorProduccion } from "@/lib/produccion/servidor";
import { cerrarSesion } from "@/app/iniciar-sesion/actions";
export const metadata = { title: "Producción", robots: { index: false, follow: false } };
export default async function ProduccionLayout({ children }: { children: ReactNode }) {
  await administradorProduccion();
  return <div className="min-h-full flex-1 bg-muted/20">
    <header className="border-b bg-background"><div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-6"><div><Logo /><p className="mt-1 text-sm text-muted-foreground">Administración · Producción</p></div><div className="flex flex-wrap items-center gap-3 text-sm"><Link className="min-h-11 rounded-lg border px-3 py-3" href="/admin">Administración comercial</Link><form action={cerrarSesion}><button className="min-h-11 rounded-lg border px-3 py-3">Cerrar sesión</button></form></div></div></header>
    <nav aria-label="Producción" className="border-b bg-background"><div className="mx-auto flex max-w-6xl flex-wrap gap-2 px-4 py-2 sm:px-6">{[["/admin/produccion", "Registro diario"], ["/admin/produccion/historial", "Historial"], ["/admin/produccion/configuracion", "Configuración"]].map(([href, texto]) => <NavigationLink key={href} href={href} exact={href === "/admin/produccion"} className="min-h-11 rounded-lg px-4 py-3 text-sm font-semibold" activeClassName="bg-primary/10 text-primary">{texto}</NavigationLink>)}</div></nav>
    <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 outline-none sm:px-6 sm:py-8">{children}</main>
  </div>;
}
