import type { ReactNode } from "react";

import { AdminHeader } from "@/components/layout/admin-header";
import { AdminSidebar } from "@/components/layout/admin-sidebar";
import { obtenerResumenChatAdmin } from "@/lib/admin/mensajes";
import { exigirSesionAdmin } from "@/lib/admin/sesion";

export default async function AdminLayout({ children }: Readonly<{ children: ReactNode }>) {
  await exigirSesionAdmin();
  const { mensajesNoLeidos } = await obtenerResumenChatAdmin();
  return (
    <div className="flex min-h-full flex-1 bg-muted/20">
      <AdminSidebar mensajesNoLeidos={mensajesNoLeidos} />
      <div className="flex min-w-0 flex-1 flex-col">
        <AdminHeader mensajesNoLeidos={mensajesNoLeidos} />
        <main id="main-content" tabIndex={-1} className="flex-1 p-4 outline-none sm:p-6 lg:p-8">
          <div className="mx-auto w-full max-w-6xl space-y-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
