"use client";
import { useActionState, useRef, useState } from "react";
import { cambiarActividad, type EstadoCambio } from "@/app/(produccion)/admin/produccion/historial-actions";
import { actividadesUnidad, etiquetasActividad, medidasActividad, type TipoActividad, type VersionActividad } from "@/lib/produccion/actividades";
import { nombreCultivo } from "@/lib/produccion/cultivos";
const campo = "mt-1 min-h-11 w-full rounded-lg border bg-background px-3 py-2 text-base";
export function CambioActividad({ version: v, clave }: { version: VersionActividad; clave: string }) {
  const [operacion, setOperacion] = useState("corregir");
  const [fecha, setFecha] = useState(v.fecha_operativa);
  const [observaciones, setObservaciones] = useState(v.observaciones ?? "");
  const [motivo, setMotivo] = useState("");
  const [confirmada, setConfirmada] = useState(false);
  const [tipo, setTipo] = useState<TipoActividad>(v.tipo_actividad);
  const [cantidad, setCantidad] = useState(v.cantidad === null ? "" : String(v.cantidad));
  const [medida, setMedida] = useState(v.unidad_medida ?? "");
  const solicitud = useRef<FormData | null>(null);
  const enviando = useRef(false);
  const [estado, accion, pendiente] = useActionState(async (anterior: EstadoCambio, datos: FormData): Promise<EstadoCambio> => {
    if (!anterior.incierto) solicitud.current = datos;
    try { return await cambiarActividad(anterior, solicitud.current!); }
    catch (error) {
      if (error && typeof error === "object" && "digest" in error && String(error.digest).startsWith("NEXT_REDIRECT")) throw error;
      return { error: "No pudimos confirmar la respuesta. Reintenta sin modificar la solicitud.", incierto: true };
    } finally { enviando.current = false; }
  }, {});
  const obligatorias = medidasActividad(v.tipo_unidad, tipo, v.cultivo ?? "lechuga");
  const medidas = obligatorias.length ? obligatorias : ["", "unidad", "kg", "g", "litro", "ml", "ramo"];
  if (estado.exito) return <div role="status" className="space-y-3 rounded-xl border bg-primary/5 p-5"><p>Cambio guardado. El historial anterior se conserva.</p><button className="min-h-11 rounded-lg border px-4 font-semibold" onClick={() => window.location.reload()}>Consultar detalle actualizado</button></div>;
  return <form action={accion} onSubmit={e => { if (enviando.current || pendiente) e.preventDefault(); else enviando.current = true; }} className="space-y-4 rounded-2xl border bg-card p-4 sm:p-6">
    <h2 className="text-xl font-semibold">Corregir o anular actividad</h2>{v.tipo_unidad === "meson" && <p className="text-sm">Cultivo histórico: {nombreCultivo(v.cultivo)}. Se conserva al corregir la fecha o anular.</p>}<p className="text-sm text-muted-foreground">Se creará una nueva versión. La unidad de trabajo se conserva. La anulación es definitiva y deja la actividad sin efecto.</p>
    <input type="hidden" name="clave" value={clave} /><input type="hidden" name="actividad" value={v.actividad_id} /><input type="hidden" name="version" value={v.numero_version} />
    <fieldset disabled={pendiente || estado.incierto || estado.conflicto} className="space-y-4 disabled:opacity-60">
      <label className="block text-sm font-medium">Operación<select name="operacion" value={operacion} onChange={e => setOperacion(e.target.value)} className={campo}><option value="corregir">Corregir datos</option><option value="anular">Anular definitivamente</option></select></label>
      {operacion === "corregir" && <>
        <label className="block text-sm font-medium">Fecha operativa<input type="date" name="fecha" value={fecha} onChange={e => setFecha(e.target.value)} min="0001-01-01" max="9999-12-31" required className={campo} /></label>
        <label className="block text-sm font-medium">Actividad<select name="tipo" value={tipo} onChange={e => { const nuevo = e.target.value as TipoActividad; setTipo(nuevo); setCantidad(""); setMedida(medidasActividad(v.tipo_unidad, nuevo, v.cultivo ?? "lechuga")[0] ?? ""); }} className={campo}>{actividadesUnidad[v.tipo_unidad].filter(t => v.tipo_actividad === "compra_alimento" ? t === "compra_alimento" : t !== "compra_alimento").map(t => <option key={t} value={t}>{etiquetasActividad[t]}</option>)}</select></label>
        <div className="grid grid-cols-2 gap-3"><label className="text-sm font-medium">Cantidad{!obligatorias.length && " (opcional)"}<input name="cantidad" value={cantidad} onChange={e => setCantidad(e.target.value)} type="number" min="0" max="999999999999.999" step={obligatorias.includes("unidad") ? "1" : "any"} required={obligatorias.length > 0} className={campo} /></label><label className="text-sm font-medium">Unidad de medida<select name="medida" value={medida} onChange={e => setMedida(e.target.value)} className={campo}>{medidas.map(m => <option key={m} value={m}>{m || "Sin cantidad"}</option>)}</select></label></div>
        <label className="block text-sm font-medium">Observaciones<textarea name="observaciones" value={observaciones} onChange={e => setObservaciones(e.target.value)} maxLength={2000} required={tipo === "libre"} rows={3} className={campo} /></label>
      </>}
      {v.tipo_actividad === "compra_alimento" && <p className="rounded-lg bg-muted p-3 text-sm">El precio total se conserva en cada versión y no se puede editar. Para cambiar el importe, anula esta compra y registra una nueva desde Registro diario.</p>}
      <label className="block text-sm font-medium">Motivo obligatorio<textarea name="motivo" value={motivo} onChange={e => setMotivo(e.target.value)} required maxLength={2000} rows={3} className={campo} /></label>
      {operacion === "anular" && <label className="flex items-start gap-3 text-sm"><input type="checkbox" checked={confirmada} onChange={e => setConfirmada(e.target.checked)} required className="mt-1 size-5 shrink-0" />Confirmo que deseo anular definitivamente esta actividad.</label>}
    </fieldset>
    {estado.error && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{estado.error}</p>}
    {estado.conflicto ? <button type="button" onClick={() => window.location.reload()} className="min-h-11 rounded-lg border px-4 font-semibold">Recargar detalle</button> : <button disabled={pendiente} className={`min-h-11 w-full rounded-lg px-4 py-3 font-semibold text-primary-foreground disabled:opacity-60 ${operacion === "anular" ? "bg-destructive" : "bg-primary"}`}>{pendiente ? "Guardando…" : estado.incierto ? "Reintentar la misma solicitud" : operacion === "anular" ? "Confirmar anulación definitiva" : "Guardar corrección"}</button>}
  </form>;
}
