"use client";
import { useActionState, useRef, useState } from "react";
import { guardarProduccion, type EstadoProduccion } from "@/app/(produccion)/admin/produccion/actions";
import type { Lugar } from "@/lib/produccion/contrato";

const campo = "mt-1 min-h-11 w-full rounded-lg border border-border bg-background px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
export function FormularioProduccion({ operacion, clave, lugares = [], lugarId, unidadId, avicola = false, fecha }: {
  operacion: "lugar" | "unidad" | "configuracion"; clave: string; lugares?: Lugar[]; lugarId?: string; unidadId?: string; avicola?: boolean; fecha: string;
}) {
  const claveSolicitud = useRef(clave);
  const solicitud = useRef<FormData | null>(null);
  const enviando = useRef(false);
  const [estado, accion, pendiente] = useActionState(async (anterior: EstadoProduccion, datos: FormData): Promise<EstadoProduccion> => {
    if (!anterior.incierto) solicitud.current = datos;
    try { return await guardarProduccion(anterior, solicitud.current!); }
    catch (error) {
      if (error && typeof error === "object" && "digest" in error && String(error.digest).startsWith("NEXT_REDIRECT")) throw error;
      return { error: "No pudimos confirmar la respuesta. Reintenta la misma solicitud sin modificar los datos.", incierto: true };
    } finally { enviando.current = false; }
  }, {});
  const [valores, setValores] = useState<Record<string, string>>({ tipo: operacion === "lugar" ? "nave" : "meson", lugar: lugarId ?? lugares[0]?.id ?? "", fecha, nombre: "", cantidad: "", observaciones: "" });
  const control = (nombre: string) => ({ name: nombre, value: valores[nombre], onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setValores(v => ({ ...v, [nombre]: e.target.value })) });
  if (estado.exito) return <div className="space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-4"><p role="status">{estado.exito}</p><button type="button" className="min-h-11 rounded-lg border px-4 text-sm font-semibold" onClick={() => window.location.reload()}>Continuar configurando</button></div>;
  return <form action={accion} onSubmit={e => { if (enviando.current || pendiente) e.preventDefault(); else enviando.current = true; }} className="space-y-4">
    <input type="hidden" name="operacion" value={operacion} /><input type="hidden" name="clave" value={claveSolicitud.current} />
    {unidadId && <input type="hidden" name="unidad" value={unidadId} />}
    <fieldset disabled={pendiente || estado.incierto || estado.conflicto} className="space-y-4 disabled:opacity-60">
      {operacion === "unidad" && <label className="block text-sm font-medium">Nave<select {...control("lugar")} required className={campo}>{lugares.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}</select></label>}
      {operacion !== "configuracion" ? <>
        <label className="block text-sm font-medium">Tipo<select {...control("tipo")} className={campo}>{(operacion === "lugar" ? [["nave", "Nave"], ["gallinero", "Gallinero"]] : [["meson", "Mesón"], ["flores", "Sector de flores"], ["suelo", "Cultivo de suelo"]]).map(([v, etiqueta]) => <option key={v} value={v}>{etiqueta}</option>)}</select></label>
        <label className="block text-sm font-medium">Nombre<input {...control("nombre")} required maxLength={160} className={campo} /></label>
      </> : <>
        <label className="block text-sm font-medium">Vigente desde<input {...control("fecha")} type="date" min="0001-01-01" max="9999-12-31" required className={campo} /></label>
        <label className="block text-sm font-medium">{avicola ? "Cantidad de gallinas" : "Capacidad máxima de lechugas"}<input {...control("cantidad")} type="number" inputMode="numeric" min={avicola ? 0 : 1} max={2147483647} step={1} required className={campo} /></label>
        <p className="text-sm text-muted-foreground">Cada cambio se guarda con una nueva fecha de vigencia. No reemplaza configuraciones anteriores ni representa movimientos de existencias.</p>
      </>}
      <label className="block text-sm font-medium">Observaciones <span className="font-normal text-muted-foreground">(opcional)</span><textarea {...control("observaciones")} rows={3} maxLength={2000} className={campo} /></label>
    </fieldset>
      {estado.error && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{estado.error}</p>}
      {estado.conflicto ? <button type="button" onClick={() => window.location.reload()} className="min-h-11 rounded-lg border px-4">Recargar</button> : <button disabled={pendiente} className="min-h-11 w-full rounded-lg bg-primary px-4 py-2 font-semibold text-primary-foreground sm:w-auto" type="submit">{pendiente ? "Guardando…" : estado.incierto ? "Reintentar la misma solicitud" : operacion === "configuracion" ? "Guardar configuración" : "Crear"}</button>}
  </form>;
}
