import { NavigationIcon } from "@/components/navigation/icon";
import { NavigationLink } from "@/components/navigation/navigation-link";
import { ADMIN_NAVIGATION } from "@/mocks/navigation";
import { ROUTES } from "@/config/routes";

export function AdminNavigation({ compact = false, mensajesNoLeidos = 0 }: { compact?: boolean; mensajesNoLeidos?: number }) {
  return (
    <nav aria-label="Navegación administrativa">
      <ul className="space-y-1">
        {ADMIN_NAVIGATION.map((item) => (
          <li key={item.href} className="rounded-lg bg-sky-500/10">
            <NavigationLink href={item.href} exact={item.href === "/admin"} aria-label={compact ? item.label : undefined} className={`relative flex min-h-11 items-center rounded-lg px-3 py-2 text-sm font-semibold text-black outline-none transition-colors hover:bg-sky-500/5 focus-visible:ring-3 focus-visible:ring-ring/50 ${compact ? "justify-center" : "gap-3"}`} activeClassName="bg-sky-500/10 hover:bg-sky-500/15">
              <NavigationIcon name={item.icon} className="size-4" />
              <span className={compact ? "sr-only" : undefined}>{item.label}</span>
              {item.href === ROUTES.adminCustomers && mensajesNoLeidos > 0 ? <span aria-label={`${mensajesNoLeidos} mensajes sin leer`} className={compact ? "absolute rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground" : "ml-auto rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground"}>{mensajesNoLeidos}</span> : null}
            </NavigationLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
