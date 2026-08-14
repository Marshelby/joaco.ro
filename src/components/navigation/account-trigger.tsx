import { CircleUserRound } from "lucide-react";

import { NavigationLink } from "@/components/navigation/navigation-link";
import type { IdentidadCuenta } from "@/lib/account/identity";

export function AccountTrigger({ identidad }: { identidad: IdentidadCuenta | null }) {
  const nombre = identidad?.nombreMostrado;
  return (
    <NavigationLink href={identidad ? "/mi-cuenta" : "/iniciar-sesion"} title={nombre} aria-label={nombre ? `Ir a Mi cuenta: ${nombre}` : undefined} className="hidden max-w-56 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 md:inline-flex" activeClassName="bg-muted text-foreground">
      <CircleUserRound className="size-4" aria-hidden="true" />
      <span className="truncate">{nombre ?? "Acceso clientes"}</span>
    </NavigationLink>
  );
}
