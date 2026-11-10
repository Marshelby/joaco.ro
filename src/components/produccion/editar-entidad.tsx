"use client";
import { useRef, useState, useTransition } from "react";
import { editarEntidad, type EstadoEntidad } from "@/app/(produccion)/admin/produccion/entidad-actions";
import type { Lugar, Unidad } from "@/lib/produccion/contrato";
const campo = "mt-1 min-h-11 w-full rounded-lg border bg-background px-3 py-2 text-base";
export function EditarEntidad({ entidad, registro, padreActivo = true }: { entidad: "lugar" | "unidad"; registro: Lugar | Unidad; padreActivo?: boolean }) {
  const [estado, setEstado] = useState<EstadoEntidad>({});
  const [pendiente, iniciar] = useTransition();
  const [nombre, setNombre] = useState(registro.nombre);
  const [descripcion, setDescripcion] = useState(registro.observaciones ?? "");
  const [activo, setActivo] = useState(registro.activo);
  const solicitud = useRef<FormData | null>(null);
  const clave = useRef<string | null>(null);
  const bloqueado = pendiente || estado.incierto || estado.conflicto;
  if (estado.exito) return <p role="status" className="rounded-lg bg-primary/5 p-3 text-sm">Cambios guardados. Se conserva el historial.</p>;
  return <details className="rounded-lg border p-3"><summary className="cursor-pointer py-2 text-sm font-semibold">Editar nombre, descripción y estado</summary>
    <form className="space-y-4 pt-3" action={datos => {
      if (!clave.current) clave.current = crypto.randomUUID();
      const envio = solicitud.current ?? datos;
      envio.set("clave", clave.current);
      solicitud.current = envio;
      iniciar(async () => {
        let resultado: EstadoEntidad;
        try { resultado = await editarEntidad({}, envio); } catch (error) {
          if (error && typeof error === "object" && "digest" in error && String(error.digest).startsWith("NEXT_REDIRECT")) throw error;
          resultado = { error: "No pudimos confirmar la respuesta. Reintenta la misma solicitud.", incierto: true };
        }
        setEstado(resultado);
        if (!resultado.incierto && !resultado.conflicto && !resultado.exito) { solicitud.current = null; clave.current = null; }
      });
    }}>
      <input type="hidden" name="entidad" value={entidad} /><input type="hidden" name="id" value={registro.id} /><input type="hidden" name="version" value={registro.version} />
      <fieldset disabled={!!bloqueado} className="space-y-4 disabled:opacity-60">
        <label className="block text-sm font-medium">Nombre<input name="nombre" value={nombre} onChange={e => setNombre(e.target.value)} maxLength={160} required className={campo} /></label>
        <label className="block text-sm font-medium">Descripción<textarea name="observaciones" value={descripcion} onChange={e => setDescripcion(e.target.value)} maxLength={2000} rows={3} className={campo} /></label>
        <label className="block text-sm font-medium">Estado<select name="activo" value={String(activo)} onChange={e => setActivo(e.target.value === "true")} className={campo}><option value="true" disabled={!padreActivo && !registro.activo}>Activo</option><option value="false">Inactivo</option></select></label>
        <p className="text-sm text-muted-foreground">{entidad === "lugar" ? "Al desactivar este lugar se bloquean nuevas actividades y configuraciones en todas sus unidades. Al reactivarlo se respeta el estado individual de cada unidad." : "Una unidad necesita estar activa y pertenecer a un lugar activo para recibir nuevas actividades o configuraciones."} El historial permanece disponible.</p>
        {!padreActivo && <p className="text-sm text-muted-foreground">El lugar está inactivo. Actívalo primero para habilitar esta unidad.</p>}
        {activo !== registro.activo && <label className="flex items-start gap-2 text-sm"><input type="checkbox" required className="mt-1 size-4" />Confirmo que deseo {activo ? "activar" : "desactivar"} este registro.</label>}
      </fieldset>
      {estado.error && <p role="alert" className="text-sm text-destructive">{estado.error}</p>}
      {estado.conflicto ? <button type="button" onClick={() => window.location.reload()} className="min-h-11 rounded-lg border px-4">Recargar</button> : <button disabled={pendiente} className="min-h-11 rounded-lg bg-primary px-4 py-2 font-semibold text-primary-foreground">{pendiente ? "Guardando…" : estado.incierto ? "Reintentar misma solicitud" : "Guardar cambios"}</button>}
    </form>
  </details>;
}
