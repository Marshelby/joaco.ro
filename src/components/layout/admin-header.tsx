import { AdminNavigation } from "@/components/navigation/admin-navigation";
import { Breadcrumbs } from "@/components/navigation/breadcrumbs";
import { MobileNavigation } from "@/components/navigation/mobile-navigation";
import { Logo } from "@/components/shared/logo";
import { ADMIN_NAVIGATION } from "@/mocks/navigation";

export function AdminHeader() {
  return (
    <header className="flex min-h-16 items-center gap-3 border-b border-border bg-background px-4 sm:px-6">
      <div className="md:hidden">
        <MobileNavigation items={ADMIN_NAVIGATION} label="Navegación administrativa" title="Administrador" />
      </div>
      <div className="md:hidden"><Logo className="rounded-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50" /></div>
      <div className="min-w-0 flex-1">
        <Breadcrumbs items={[{ label: "Administración" }]} />
      </div>
      <span className="hidden rounded-full border border-border px-3 py-1 text-xs text-muted-foreground sm:inline">Administrador</span>
    </header>
  );
}
