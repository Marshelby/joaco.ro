import { NavigationIcon } from "@/components/navigation/icon";
import { NavigationLink } from "@/components/navigation/navigation-link";
import { CUSTOMER_NAVIGATION } from "@/mocks/navigation";

export function AccountNavigation() {
  return (
    <nav aria-label="Navegación de cuenta">
      <ul className="grid gap-1 sm:grid-cols-2 lg:grid-cols-4">
        {CUSTOMER_NAVIGATION.map((item) => (
          <li key={item.href}>
            <NavigationLink href={item.href} exact={item.href === "/mi-cuenta"} className="flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50" activeClassName="bg-muted text-foreground">
              <NavigationIcon name={item.icon} className="size-4" />
              {item.label}
            </NavigationLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
