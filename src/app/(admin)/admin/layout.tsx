import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { AdminHeader } from "@/components/layout/admin-header";
import { AdminSidebar } from "@/components/layout/admin-sidebar";
import { crearClienteSupabaseServidor } from "@/lib/supabase/server";

export default async function AdminLayout({ children }: Readonly<{ children: ReactNode }>) {
  const supabase = await crearClienteSupabaseServidor();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/iniciar-sesion");
  const { data: perfil } = await supabase.from("perfiles").select("rol").eq("usuario_id", user.id).maybeSingle();
  if (perfil?.rol !== "admin") redirect("/");
  return (
    <div className="flex min-h-full flex-1 bg-muted/20">
      <AdminSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <AdminHeader />
        <main id="main-content" tabIndex={-1} className="flex-1 p-4 outline-none sm:p-6 lg:p-8">
          <div className="mx-auto w-full max-w-6xl space-y-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
