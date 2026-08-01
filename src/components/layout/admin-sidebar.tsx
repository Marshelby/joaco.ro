import { AdminNavigation } from "@/components/navigation/admin-navigation";
import { Logo } from "@/components/shared/logo";

export function AdminSidebar() {
  return (
    <aside className="hidden w-20 shrink-0 border-r border-sidebar-border bg-sidebar p-3 md:block lg:w-64 lg:p-4">
      <div className="mb-8 flex justify-center lg:block lg:px-3">
        <Logo className="rounded-sm outline-none focus-visible:ring-3 focus-visible:ring-sidebar-ring/50" />
        <p className="mt-2 hidden text-xs text-sidebar-foreground/70 lg:block">Panel administrativo</p>
      </div>
      <div className="lg:hidden"><AdminNavigation compact /></div>
      <div className="hidden lg:block"><AdminNavigation /></div>
    </aside>
  );
}
