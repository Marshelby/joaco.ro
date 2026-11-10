import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight, ClipboardPenLine, History, LayoutDashboard, LogOut, Settings2, Sprout } from "lucide-react";
import { Logo } from "@/components/shared/logo";
import { NavigationLink } from "@/components/navigation/navigation-link";
import { administradorProduccion } from "@/lib/produccion/servidor";
import { cerrarSesion } from "@/app/iniciar-sesion/actions";
import "./produccion.css";
export const metadata = { title: "Producción", robots: { index: false, follow: false } };
export default async function ProduccionLayout({ children }: { children: ReactNode }) {
  await administradorProduccion();
  return <div className="produccion-shell min-h-full flex-1">
    <header className="prod-header"><div className="prod-container flex flex-wrap items-center justify-between gap-4 py-4"><div className="flex items-center gap-4"><Logo /><span className="prod-module"><Sprout size={16} aria-hidden="true" /> Producción</span></div><div className="flex items-center gap-2 text-sm"><Link className="prod-header-action" href="/admin">Área comercial<ArrowUpRight size={16} aria-hidden="true" /></Link><form action={cerrarSesion}><button className="prod-header-action" aria-label="Cerrar sesión"><LogOut size={16} aria-hidden="true" /><span className="hidden sm:inline">Cerrar sesión</span></button></form></div></div></header>
    <nav aria-label="Producción" className="prod-navigation"><div className="prod-container prod-tabs">{[
      { href: "/admin/produccion/resumen", texto: "Resumen", Icono: LayoutDashboard },
      { href: "/admin/produccion", texto: "Registro diario", Icono: ClipboardPenLine },
      { href: "/admin/produccion/historial", texto: "Historial", Icono: History },
      { href: "/admin/produccion/configuracion", texto: "Configuración", Icono: Settings2 },
    ].map(({ href, texto, Icono }) => <NavigationLink key={href} href={href} exact={href === "/admin/produccion"} className="prod-tab" activeClassName="prod-tab-active"><Icono size={18} aria-hidden="true" /><span>{texto}</span></NavigationLink>)}</div></nav>
    <main id="main-content" tabIndex={-1} className="prod-container prod-main space-y-6 outline-none">{children}</main>
    <footer className="prod-container prod-footer"><Sprout size={15} aria-hidden="true" /> Hidro Leufú <span>·</span> Cuidamos lo que crece.</footer>
  </div>;
}
