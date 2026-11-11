"use client";

import { useFormStatus } from "react-dom";
import { gestionarReparto } from "./actions";

type Usuario = { usuario_id: string; nombre: string | null; correo: string | null };

export function PermissionForm({ usuarios, activo = true }: { usuarios: Usuario[]; activo?: boolean }) {
  return <form action={gestionarReparto} className="space-y-3" onSubmit={event => {
    if (!activo && !window.confirm("¿Revocar el permiso de reparto? El usuario perderá acceso a sus asignaciones.")) event.preventDefault();
  }}>
    <input type="hidden" name="accion" value="rol" />
    <input type="hidden" name="activo" value={String(activo)} />
    {usuarios.length === 1 && !activo ? <input type="hidden" name="usuario" value={usuarios[0].usuario_id} /> :
      <label className="block">Usuario registrado
        <select name="usuario" required defaultValue="" className="mt-2 min-h-12 w-full rounded border bg-background p-3">
          <option value="" disabled>Selecciona un usuario</option>
          {usuarios.map(u => <option key={u.usuario_id} value={u.usuario_id}>{u.nombre || "Sin nombre"} · {u.correo || "Sin correo"}</option>)}
        </select>
      </label>}
    <Submit activo={activo} />
  </form>;
}

function Submit({ activo }: { activo: boolean }) {
  const { pending } = useFormStatus();
  return <button disabled={pending} className="min-h-12 w-full rounded border p-3 disabled:opacity-60">{pending ? "Guardando…" : activo ? "Habilitar repartidor" : "Revocar permiso"}</button>;
}
