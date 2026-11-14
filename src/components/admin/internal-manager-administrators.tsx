import { administradorComercial } from "@/lib/admin/cliente-comercial";

export default async function InternalManagerAdministrators() {
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
    <div>
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
    </div>
  );
}
