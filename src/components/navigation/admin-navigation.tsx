import { NavigationIcon } from "@/components/navigation/icon";
import { NavigationLink } from "@/components/navigation/navigation-link";
import { ADMIN_NAVIGATION } from "@/mocks/navigation";

export function AdminNavigation({ compact = false }: { compact?: boolean }) {
  return (
    <nav aria-label="Navegación administrativa">
      <ul className="space-y-1">
        {ADMIN_NAVIGATION.map((item) => (
          <li key={item.href}>
            <NavigationLink href={item.href} exact={item.href === "/admin"} aria-label={compact ? item.label : undefined} className={`flex min-h-11 items-center rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 ${compact ? "justify-center" : "gap-3"}`} activeClassName="bg-muted text-foreground">
              <NavigationIcon name={item.icon} className="size-4" />
              <span className={compact ? "sr-only" : undefined}>{item.label}</span>
            </NavigationLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
