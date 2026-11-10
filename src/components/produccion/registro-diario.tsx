"use client";
import { useActionState, useRef, useState } from "react";
import Link from "next/link";
import { ClipboardPenLine, Clock3 } from "lucide-react";
import { IconoLugar, IdentidadUnidad } from "./identidad";
import { registrarActividad, type EstadoActividad } from "@/app/(produccion)/admin/produccion/actividad-actions";
import { actividadesUnidad, etiquetasActividad, medidasActividad, type TipoActividad, type ActividadDiaria } from "@/lib/produccion/actividades";
import { nombresUnidad, type Lugar, type Unidad } from "@/lib/produccion/contrato";
import { nombreCultivo } from "@/lib/produccion/cultivos";
const campo = "mt-1 min-h-11 w-full rounded-lg border border-border bg-background px-3 py-2 text-base";
export function RegistroDiario({ fecha, lugares, unidades, actividades, claveInicial }: { fecha: string; lugares: Lugar[]; unidades: Unidad[]; actividades: ActividadDiaria[]; claveInicial: string }) {
  const [bloqueado, setBloqueado] = useState(false);
  const [lugar, setLugar] = useState(lugares[0]?.id ?? "");
  const propias = unidades.filter(u => u.lugar_id === lugar);
  const [unidadId, setUnidad] = useState(propias[0]?.id ?? "");
  const unidad = propias.find(u => u.id === unidadId);
  const lugarActivo = lugares.find(l => l.id === lugar)?.activo === true;
  const [intento, setIntento] = useState(claveInicial);
  const visibles = actividades.filter(a => propias.some(u => u.id === a.produccion_actividades.unidad_id));
  return <div className="prod-register-grid">
    <section className="prod-register space-y-4 rounded-2xl border bg-card p-4 sm:p-6"><div><h2 className="prod-section-heading"><ClipboardPenLine size={21} aria-hidden="true" />Registrar actividad</h2><p className="prod-section-copy">Selecciona un espacio y su unidad de trabajo.</p></div>
      {lugares.length <= 6 && <div className="prod-selector" role="group" aria-label="Seleccionar nave o gallinero">{lugares.map(l => <button type="button" key={l.id} disabled={bloqueado} aria-pressed={lugar === l.id} className="prod-select-card" onClick={() => { if (lugar === l.id) return; setIntento(crypto.randomUUID()); setLugar(l.id); setUnidad(unidades.find(u => u.lugar_id === l.id)?.id ?? ""); }}><IconoLugar tipo={l.tipo} /><span className="min-w-0"><span className="block break-words text-sm font-semibold">{l.nombre}</span><span className="mt-1 block text-xs text-muted-foreground">{l.tipo === "nave" ? "Nave" : "Gallinero"}{!l.activo ? " · Inactivo" : ""}</span></span></button>)}</div>}
      {lugares.length > 6 && <label className="block text-sm font-medium">Nave o gallinero<select className={campo} value={lugar} disabled={bloqueado} onChange={e => { setIntento(crypto.randomUUID()); setLugar(e.target.value); setUnidad(unidades.find(u => u.lugar_id === e.target.value)?.id ?? ""); }}>{lugares.map(l => <option key={l.id} value={l.id}>{l.nombre} · {l.tipo === "nave" ? "Nave" : "Gallinero"}{!l.activo ? " · Inactivo" : ""}</option>)}</select></label>}
      <label className="block text-sm font-medium">Unidad de trabajo<select className={campo} value={unidadId} disabled={bloqueado} onChange={e => { setIntento(crypto.randomUUID()); setUnidad(e.target.value); }}><option value="" disabled>Selecciona una unidad</option>{propias.map(u => <option key={u.id} value={u.id}>{u.nombre} · {nombresUnidad[u.tipo]}{u.tipo === "meson" ? ` · ${nombreCultivo(u.cultivo)}` : ""}{!u.activo ? " · Inactiva" : ""}</option>)}</select></label>
      {!propias.length && <p>No hay unidades en este lugar. Agrégalas desde Configuración.</p>}
      {unidad?.tipo === "suelo" && <p className="text-sm text-muted-foreground">El cultivo de suelo se conserva como unidad configurable. Su registro de actividades estará disponible en una fase posterior.</p>}
      {(!lugarActivo || (unidad && !unidad.activo)) && <p role="status" className="rounded-lg bg-muted p-3 text-sm">Este lugar o unidad está inactivo. Puedes consultar sus actividades; para registrar nuevas, actívalo desde Configuración.</p>}
      {unidad && unidad.activo && lugarActivo && unidad.tipo !== "suelo" && <FormularioActividad key={`${fecha}:${unidad.id}:${intento}`} fecha={fecha} unidad={unidad} lugar={lugar} clave={intento} bloquear={setBloqueado} otra={() => setIntento(crypto.randomUUID())} />}
    </section>
    <section className="space-y-3"><div><h2 className="prod-section-heading"><Clock3 size={20} aria-hidden="true" />Actividades del día</h2><p className="mt-2 break-words text-sm font-medium">{lugares.find(l => l.id === lugar)?.nombre}</p></div><p className="text-sm text-muted-foreground">Todos los registros del lugar seleccionado, incluidas sus distintas unidades.</p>
      {!visibles.length && <p className="rounded-xl border border-dashed p-5">Sin actividades registradas para esta fecha y lugar.</p>}
      <ul className="prod-activity-list">{visibles.map(a => <li key={a.id} className="space-y-1 rounded-xl border bg-card p-4"><p className="font-semibold">{etiquetasActividad[a.tipo_actividad]}{a.tipo_unidad === "meson" ? ` · ${nombreCultivo(a.cultivo)}` : ""}</p><p className="text-sm text-muted-foreground">{unidades.find(u => u.id === a.produccion_actividades.unidad_id)?.nombre} · {new Intl.DateTimeFormat("es-CL", { timeZone: "America/Santiago", hour: "2-digit", minute: "2-digit" }).format(new Date(a.fecha_registro))}</p>{a.cantidad !== null && <p>{Number(a.cantidad).toLocaleString("es-CL", { maximumFractionDigits: 12 })} {a.unidad_medida}</p>}{a.tipo_actividad === "compra_alimento" && <p>{a.precio_total === undefined ? "Precio total no disponible en el registro original" : `Precio total: $${a.precio_total.toLocaleString("es-CL", { maximumFractionDigits: 12 })} CLP`}</p>}{a.observaciones && <p className="whitespace-pre-wrap break-words text-sm">{a.observaciones}</p>}<Link href={`/admin/produccion/historial/${a.actividad_id}`} className="inline-flex min-h-11 items-center text-sm font-semibold text-primary underline underline-offset-4">Ver detalle y corregir</Link></li>)}</ul>
    </section>
  </div>;
}
function FormularioActividad({ fecha, unidad, lugar, clave, otra, bloquear }: { fecha: string; unidad: Unidad; lugar: string; clave: string; otra: () => void; bloquear: (valor: boolean) => void }) {
  const enviando = useRef(false);
  const [estado, accion, pendiente] = useActionState(async (anterior: EstadoActividad, datos: FormData): Promise<EstadoActividad> => {
    bloquear(true);
    try {
      const resultado = await registrarActividad(anterior, datos);
      bloquear(Boolean(resultado.incierto));
      return resultado;
    } catch (error) {
      if (error && typeof error === "object" && "digest" in error && String(error.digest).startsWith("NEXT_REDIRECT")) throw error;
      return { error: "No pudimos confirmar la respuesta. Reintenta este mismo registro sin cambiar los datos.", incierto: true };
    } finally { enviando.current = false; }
  }, {});
  const [tipo, setTipo] = useState<TipoActividad>(actividadesUnidad[unidad.tipo][0]);
  const [valores, setValores] = useState({ cantidad: "", medida: "", precio: "", observaciones: "" });
  const medidas = medidasActividad(unidad.tipo, tipo, unidad.cultivo ?? "lechuga");
  const control = (nombre: keyof typeof valores) => ({ value: valores[nombre], onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setValores(v => ({ ...v, [nombre]: e.target.value })) });
  if (estado.exito) return <div className="space-y-3"><p role="status" className="text-primary">Actividad guardada correctamente.</p><button type="button" onClick={otra} className="min-h-11 w-full rounded-lg bg-primary px-4 py-2 font-semibold text-primary-foreground">Registrar otra actividad</button></div>;
  return <form action={accion} onSubmit={e => { if (enviando.current || pendiente) e.preventDefault(); else enviando.current = true; }} className="space-y-4">
    <input type="hidden" name="cultivo" value={unidad.tipo === "meson" ? unidad.cultivo ?? "lechuga" : ""} /><input type="hidden" name="clave" value={clave} /><input type="hidden" name="fecha" value={fecha} /><input type="hidden" name="lugar" value={lugar} /><input type="hidden" name="unidad" value={unidad.id} />
    <fieldset disabled={pendiente} className="space-y-4 disabled:opacity-60">
      <IdentidadUnidad tipo={unidad.tipo} cultivo={unidad.cultivo}>{unidad.tipo === "meson" ? nombreCultivo(unidad.cultivo) : nombresUnidad[unidad.tipo]} · {unidad.nombre}</IdentidadUnidad>
      <label className="block text-sm font-medium">Actividad<select name="tipo" value={tipo} disabled={estado.incierto} onChange={e => { setTipo(e.target.value as TipoActividad); setValores(v => ({ ...v, cantidad: "", medida: "", precio: "" })); }} className={campo}>{actividadesUnidad[unidad.tipo].map(t => <option key={t} value={t}>{etiquetasActividad[t]}</option>)}</select></label>
      {estado.incierto && <input type="hidden" name="tipo" value={tipo} />}
      {medidas.length > 0 ? <div className="grid grid-cols-2 gap-3"><label className="block text-sm font-medium">Cantidad<input name="cantidad" {...control("cantidad")} readOnly={estado.incierto} type="number" inputMode={medidas.includes("unidad") ? "numeric" : "decimal"} min={medidas.includes("unidad") ? 1 : "0.000000000001"} max="999999999999.999" step={medidas.includes("unidad") ? 1 : "any"} required className={campo} /></label><label className="block text-sm font-medium">Unidad<select name="medida" disabled={estado.incierto} value={valores.medida || medidas[0]} onChange={e => setValores(v => ({ ...v, medida: e.target.value }))} className={campo}>{medidas.map(m => <option key={m} value={m}>{m === "unidad" ? "Unidades" : m === "ramo" ? "Ramos" : m}</option>)}</select>{estado.incierto && <input type="hidden" name="medida" value={valores.medida || medidas[0]} />}</label></div> : <><input type="hidden" name="cantidad" value="" /><input type="hidden" name="medida" value="" /></>}
      {tipo === "compra_alimento" ? <label className="block text-sm font-medium">Precio total (pesos chilenos)<input name="precio" {...control("precio")} readOnly={estado.incierto} type="number" inputMode="decimal" min="0.01" max="999999999999.99" step="0.01" required className={campo} /></label> : <input type="hidden" name="precio" value="" />}
      <label className="block text-sm font-medium">{tipo === "libre" ? "Descripción de la actividad" : "Observaciones (opcional)"}<textarea name="observaciones" {...control("observaciones")} readOnly={estado.incierto} required={tipo === "libre"} maxLength={2000} rows={2} className={campo} /></label>
      {estado.error && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{estado.error}</p>}
      <button type="submit" className="min-h-11 w-full rounded-lg bg-primary px-4 py-2 font-semibold text-primary-foreground">{pendiente ? "Guardando…" : estado.incierto ? "Reintentar el mismo registro" : "Guardar actividad"}</button>
    </fieldset>
  </form>;
}
