import type { Metadata } from "next";
import { ShieldCheck, Truck } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { administradorComercial } from "@/lib/admin/cliente-comercial";

export const metadata: Metadata = { title: "Personal Hidro Leufú" };

export default async function AdminStaffPage() {
  const supabase = await administradorComercial();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: administradores, error } = await supabase
    .from("perfiles")
    .select("usuario_id,nombre")
    .eq("rol", "admin")
    .order("nombre", { ascending: true })
    .order("usuario_id", { ascending: true });

  // El vínculo explícito por usuario_id evita inferir identidad por nombre o correo.
  const ids = (administradores ?? []).map((perfil) => perfil.usuario_id);
  const cuentas = !error && ids.length > 0
    ? await supabase.from("clientes").select("usuario_id,email").in("usuario_id", ids)
    : null;
  const correos = new Map<string, string>();
  if (!cuentas?.error) {
    for (const cuenta of cuentas?.data ?? []) {
      if (cuenta.usuario_id && cuenta.email?.trim()) {
        correos.set(cuenta.usuario_id, cuenta.email.trim());
      }
    }
  }
  if (user?.email) correos.set(user.id, user.email);

  return (
    <div className="space-y-8">
      <PageHeader title="Personal Hidro Leufú" description="Consulta los administradores actuales y el espacio del equipo de reparto." />

      <section aria-labelledby="administradores-title" className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex items-start gap-3 border-b border-border p-5 sm:p-6">
          <div className="rounded-lg bg-primary/10 p-2 text-primary">
            <ShieldCheck aria-hidden="true" className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="administradores-title" className="text-xl font-semibold tracking-tight">Administradores</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">Usuarios con rol administrador en Hidro Leufú.</p>
          </div>
        </div>
        {error ? (
          <p role="status" className="p-5 text-sm text-muted-foreground sm:p-6">No fue posible cargar los administradores. Vuelve a intentar más tarde.</p>
        ) : administradores?.length ? (
          <ul className="divide-y divide-border">
            {administradores.map((perfil) => {
              const nombre = perfil.nombre?.trim();
              const correo = correos.get(perfil.usuario_id);
              return (
                <li key={perfil.usuario_id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                  <div className="min-w-0 space-y-1">
                    <p className="break-words font-medium text-foreground">{nombre || "Nombre no disponible"}</p>
                    <p className="break-all text-sm text-muted-foreground">{correo || "Correo no disponible"}</p>
                  </div>
                  <span className="w-fit shrink-0 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">Administrador</span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="p-5 text-sm text-muted-foreground sm:p-6">No hay administradores disponibles para mostrar.</p>
        )}
      </section>

      <section aria-labelledby="repartidores-title" className="rounded-xl border border-border bg-card p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="repartidores-title" className="text-xl font-semibold tracking-tight">Repartidores</h2>
          <span className="rounded-full border border-border bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">Próximamente</span>
        </div>
        <div className="mt-6 flex flex-col items-center rounded-lg border border-dashed border-border bg-muted/20 px-5 py-8 text-center sm:py-10">
          <div className="rounded-full bg-primary/10 p-3 text-primary">
            <Truck aria-hidden="true" className="size-6" />
          </div>
          <p className="mt-4 font-medium text-foreground">Un espacio para el equipo de reparto</p>
          <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">La sección de repartidores estará disponible próximamente.</p>
        </div>
      </section>
    </div>
  );
}
