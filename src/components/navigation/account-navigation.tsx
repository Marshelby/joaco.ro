import { NavigationIcon } from "@/components/navigation/icon";
import { NavigationLink } from "@/components/navigation/navigation-link";
import { obtenerResumenMensajesCuenta } from "@/lib/account/mensajes";
import type { NavigationItem } from "@/types/navigation";
import { CUSTOMER_NAVIGATION } from "@/mocks/navigation";

export async function AccountNavigation({ accesoReparto = false, cuentaActiva = true }: { accesoReparto?: boolean; cuentaActiva?: boolean }) {
  const { mensajesAdminNoLeidos } = cuentaActiva ? await obtenerResumenMensajesCuenta() : { mensajesAdminNoLeidos: 0 };
  const items: readonly NavigationItem[] = [
    ...(cuentaActiva ? CUSTOMER_NAVIGATION : [CUSTOMER_NAVIGATION[0]]),
    ...(accesoReparto ? [{ label: "Mi reparto", href: "/reparto", icon: "routes" } satisfies NavigationItem] : []),
  ];

  return (
    <nav aria-label="Navegación de cuenta">
      <ul className={`grid gap-1 sm:grid-cols-2 ${accesoReparto && cuentaActiva ? "lg:grid-cols-6" : "lg:grid-cols-5"}`}>
        {items.map((item) => (
          <li key={item.href}>
            <NavigationLink prefetch={item.href === "/reparto" ? false : undefined} href={item.href} exact={item.href === "/mi-cuenta"} className="flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50" activeClassName="bg-muted text-foreground">
              <NavigationIcon name={item.icon} className="size-4" />
              <span>{item.label}</span>
              {item.href === "/mi-cuenta/mensajes" && mensajesAdminNoLeidos > 0 ? <span aria-label={`${mensajesAdminNoLeidos} mensajes sin leer`} className="ml-auto rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">{mensajesAdminNoLeidos}</span> : null}
            </NavigationLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
