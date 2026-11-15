"use client";

import { useState, useTransition } from "react";
import { guardarCompraDia } from "@/app/(admin)/admin/rutas/compra-actions";

export type ProductoCompraDia = {
  clave: string; clave_operativa: string; requiere_ajuste: boolean; producto: string; presentacion: string | null; unidad: string;
  modo: string; requerida: number; revision: string; asignada: number | null;
  precio: number | null; version: number; actualizado: string | null;
};
const numero = (n: number) => new Intl.NumberFormat("es-CL", { maximumFractionDigits: 3 }).format(n);

export function DayPurchaseRow({ producto: p, fecha }: { producto: ProductoCompraDia; fecha: string }) {
  const [abierto, setAbierto] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [pendiente, iniciar] = useTransition();
  const [cantidad, setCantidad] = useState(String(p.asignada ?? ""));
  const [precio, setPrecio] = useState(String(p.precio ?? ""));
  const unidad = p.modo === "kg_fraccionable" ? "kg" : p.modo === "presentacion_cerrada" ? `presentación (${p.presentacion ?? p.unidad})` : p.modo === "unidad" ? "unidad" : p.unidad;
  const formato = (n: number) => `${numero(n)} ${unidad}`;
  const cubierta = Math.min(p.asignada ?? 0, p.requerida);
  const verificable = ["kg_fraccionable", "unidad", "presentacion_cerrada"].includes(p.modo);
  return <li className="min-w-0 space-y-3 border-b py-3">
    <div className="flex items-start justify-between gap-2">
      <div><h3 className="text-sm font-medium">{p.producto}</h3><p className="text-xs text-muted-foreground">{p.presentacion ?? "Sin presentación histórica"} · {p.unidad}</p></div>
      <button type="button" disabled={!verificable || pendiente} aria-expanded={abierto} aria-controls={`compra-${p.clave}`} onClick={() => setAbierto(!abierto)} className="shrink-0 rounded-md border px-2 py-1 text-xs disabled:opacity-50">{p.version ? "Editar compra" : "Registrar compra"}</button>
    </div>
    <dl className="grid grid-cols-2 gap-2 text-xs">
      {[["Requerida", formato(p.requerida)], ["Comprada asignada", p.asignada === null ? "Sin registro" : formato(p.asignada)], ["Cubierta", formato(cubierta)], ["Faltante", formato(Math.max(0, p.requerida - cubierta))]].map(([titulo, valor]) => <div key={titulo}><dt className="text-muted-foreground">{titulo}</dt><dd className="font-semibold">{valor}</dd></div>)}
    </dl>
    <p className="text-xs text-muted-foreground">{p.precio === null ? (p.version ? "Registro histórico con unidad incompatible: sin costo ni cobertura acreditados. Revisa la presentación." : "Sin compra registrada: no hay cobertura acreditada.") : `Precio de compra: $${numero(p.precio)} CLP por ${unidad}.`}</p>
    {p.requiere_ajuste && <p className="text-xs text-amber-800">La demanda cambió desde el registro. La asignación se limita al requerimiento actual; revisa y guarda el total corregido.</p>}
    {!verificable && <p className="text-xs text-amber-800">Unidad o presentación histórica sin verificar. Registro bloqueado para evitar conversiones incorrectas.</p>}
    {abierto && <form id={`compra-${p.clave}`} className="space-y-3 rounded-lg bg-muted/40 p-3" action={(datos) => iniciar(async () => {
      setMensaje("");
      try {
        const resultado = await guardarCompraDia(datos);
        setMensaje(resultado.error ?? "Compra guardada. Solo se asignó la cantidad necesaria para el día.");
        if (resultado.guardado) setAbierto(false);
      } catch { setMensaje("No se pudo confirmar el guardado. Recarga para verificar antes de reintentar."); }
    })}>
      <input type="hidden" name="fecha" value={fecha} /><input type="hidden" name="clave" value={p.clave} /><input type="hidden" name="revision" value={p.revision} /><input type="hidden" name="version" value={p.version} />
      <label className="block text-xs">Precio de compra · CLP por {unidad}<input className="mt-1 block w-full rounded border bg-background p-2" name="precio" type="number" min="0" max="999999999.999" step="0.001" required value={precio} onChange={e => setPrecio(e.target.value)} disabled={pendiente} /></label>
      <label className="block text-xs">Cantidad total para asignar · {unidad}<input className="mt-1 block w-full rounded border bg-background p-2" name="cantidad" type="number" min="0" max="999999999.999" step={p.modo === "kg_fraccionable" ? "0.001" : "1"} required value={cantidad} onChange={e => setCantidad(e.target.value)} disabled={pendiente} /></label>
      <p className="text-xs">Se guardará como máximo {formato(p.requerida)}. Los excedentes quedan fuera de este registro. Al editar, ingresa el total corregido, no una compra adicional.</p>
      {cantidad !== "" && Number.isFinite(Number(cantidad)) && Number(cantidad) >= 0 && <p className="text-xs">Asignación a guardar: {formato(Math.min(Number(cantidad), p.requerida))} · Faltante: {formato(Math.max(0, p.requerida - Number(cantidad)))}</p>}
      <button disabled={pendiente} className="rounded-md border bg-background px-3 py-2 text-xs disabled:opacity-50">{pendiente ? "Guardando…" : "Guardar compra"}</button>
    </form>}
    <p role="status" className="text-xs">{mensaje}</p>
  </li>;
}
