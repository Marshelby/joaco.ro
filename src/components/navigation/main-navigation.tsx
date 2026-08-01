import { NavigationLink } from "@/components/navigation/navigation-link";
import { PUBLIC_NAVIGATION } from "@/mocks/navigation";

export function MainNavigation() {
  return (
    <nav className="hidden items-center gap-1 md:flex" aria-label="Navegación principal">
      {PUBLIC_NAVIGATION.map((item) => (
        <NavigationLink key={item.href} href={item.href} className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50" activeClassName="bg-muted text-foreground">
          {item.label}
        </NavigationLink>
      ))}
    </nav>
  );
}
