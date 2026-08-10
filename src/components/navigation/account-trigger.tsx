import { CircleUserRound } from "lucide-react";

import { NavigationLink } from "@/components/navigation/navigation-link";

export function AccountTrigger() {
  return (
    <NavigationLink href="/iniciar-sesion" className="hidden items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 md:inline-flex" activeClassName="bg-muted text-foreground">
      <CircleUserRound className="size-4" aria-hidden="true" />
      <span>Acceso clientes</span>
    </NavigationLink>
  );
}
