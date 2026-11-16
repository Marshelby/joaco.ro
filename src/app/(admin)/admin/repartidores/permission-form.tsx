"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { actualizarPermisoReparto, gestionarReparto } from "./actions";

type Usuario = { usuario_id: string; nombre: string | null; correo: string | null };

export function PermissionForm({ usuarios, activo = true, compact = false, onUpdated }: { usuarios: Usuario[]; activo?: boolean; compact?: boolean; onUpdated?: (usuario: Usuario, activo: boolean) => void }) {
  const [error, setError] = useState("");
  async function guardar(formData: FormData) {
    setError("");
    try {
      const resultado = await actualizarPermisoReparto(formData);
      if (resultado.error) setError(resultado.error);
      else if (usuarios[0]) onUpdated?.(usuarios[0], activo);
    } catch {
      setError("No se pudo confirmar el cambio. Revisa tu conexión e intenta nuevamente.");
    }
  }
  return <form action={onUpdated ? guardar : gestionarReparto} className={compact ? "min-w-0 max-w-full" : "space-y-3"} onSubmit={event => {
    if (!activo && !window.confirm("¿Revocar el permiso de reparto? El usuario perderá acceso a sus asignaciones.")) event.preventDefault();
  }}>
    <input type="hidden" name="accion" value="rol" />
    <input type="hidden" name="activo" value={String(activo)} />
    {usuarios.length === 1 && (compact || !activo) ? <input type="hidden" name="usuario" value={usuarios[0].usuario_id} /> :
      <label className="block">Usuario registrado
        <select name="usuario" required defaultValue="" className="mt-2 min-h-12 w-full rounded border bg-background p-3">
          <option value="" disabled>Selecciona un usuario</option>
          {usuarios.map(u => <option key={u.usuario_id} value={u.usuario_id}>{u.nombre || "Sin nombre"} · {u.correo || "Sin correo"}</option>)}
        </select>
      </label>}
    {error && <p role="alert" className="max-w-64 text-xs text-destructive">{error}</p>}
    <Submit activo={activo} compact={compact} usuario={compact ? usuarios[0] : undefined} />
  </form>;
}

function Submit({ activo, compact, usuario }: { activo: boolean; compact: boolean; usuario?: Usuario }) {
  const { pending } = useFormStatus();
  return <button disabled={pending} aria-label={usuario ? `${activo ? "Habilitar repartidor" : "Revocar permiso de"} ${usuario.nombre || usuario.correo || "usuario sin nombre"}${usuario.nombre && usuario.correo ? ` (${usuario.correo})` : ""}` : undefined} className={compact ? "min-h-11 rounded-md border border-border px-3 py-2 text-sm font-medium transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-60" : "min-h-12 w-full rounded border p-3 disabled:opacity-60"}>{pending ? "Guardando…" : activo ? compact ? "Habilitar" : "Habilitar repartidor" : compact ? "Revocar" : "Revocar permiso"}</button>;
}
