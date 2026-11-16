"use client";

import { useId, useState, useTransition } from "react";
import { guardarCompraDia } from "@/app/(admin)/admin/rutas/compra-actions";

export type CompraDia = { id: string; cantidad_asignada: number; precio_compra: number; version: number; actualizado_en: string };
export type ProductoCompraDia = {
  clave: string; clave_operativa: string | null; requiere_ajuste: boolean; producto: string; presentacion: string | null; unidad: string;
  modo: string; requerida: number; revision: string; asignada: number | null;
  precio: number | null; version: number; actualizado: string | null;
  compras?: CompraDia[]; comprada?: number; costo_total?: number | null;
  venta?: number; venta_reconocida?: number | null; sin_desglose?: number;
};
const numero = (n: number) => new Intl.NumberFormat("es-CL", { maximumFractionDigits: 3 }).format(n);

export function DayPurchaseRow({ producto: p, fecha }: { producto: ProductoCompraDia; fecha: string }) {
  const [abierto, setAbierto] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [pendiente, iniciar] = useTransition();
  const [edicion, setEdicion] = useState<CompraDia | null>(null);
  const [idCompra, setIdCompra] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [precio, setPrecio] = useState("");
  const id = useId();
  const multiple = p.compras !== undefined;
  const unidad = p.modo === "kg_fraccionable" ? "kg" : p.modo === "presentacion_cerrada" ? `presentación (${p.presentacion ?? p.unidad})` : p.modo === "unidad" ? "unidad" : p.unidad;
  const formato = (n: number) => `${numero(n)} ${unidad}`;
  const comprada = p.comprada ?? p.asignada ?? 0;
  const faltan = Math.max(0, Math.round((p.requerida - (p.asignada ?? 0)) * 1000) / 1000);
  const verificable = ["kg_fraccionable", "unidad", "presentacion_cerrada"].includes(p.modo);
  const maximo = multiple ? Math.max(0, Math.round((p.requerida - comprada + (edicion?.cantidad_asignada ?? 0)) * 1000) / 1000) : p.requerida;
  function abrir(compra: CompraDia | null = null) {
    setEdicion(compra);
    setIdCompra(compra?.id ?? (multiple ? crypto.randomUUID() : ""));
    setCantidad(String(compra?.cantidad_asignada ?? (multiple ? faltan : p.asignada ?? p.requerida)));
    setPrecio(String(compra?.precio_compra ?? (multiple ? "" : p.precio ?? "")));
    setAbierto(true);
  }
  return <li className="min-w-0 space-y-2 border-b py-3">
    <div className="flex items-start justify-between gap-2">
      <div><h3 className="text-sm font-medium">{p.producto}</h3><p className="text-xs text-muted-foreground">{p.presentacion ?? "Sin presentación histórica"} · {p.unidad}</p></div>
      <button type="button" disabled={!verificable || pendiente} aria-expanded={abierto} aria-controls={id} onClick={() => abierto ? setAbierto(false) : abrir(multiple && comprada >= p.requerida ? p.compras?.[0] ?? null : null)} className="shrink-0 rounded-md border px-2 py-1 text-xs disabled:opacity-50">{multiple ? (comprada >= p.requerida && p.compras?.length ? "Editar compra" : comprada > 0 && faltan > 0 ? "Registrar compra restante" : "Registrar compra") : p.version ? "Editar compra" : "Registrar compra"}</button>
    </div>
    <dl className="grid grid-cols-3 gap-2 text-xs">
      {[["Necesitamos", formato(p.requerida)], ["Compramos", formato(comprada)], ["Faltan", formato(faltan)]].map(([titulo, valor]) => <div key={titulo}><dt className="text-muted-foreground">{titulo}</dt><dd className="font-semibold">{valor}</dd></div>)}
    </dl>
    {p.precio !== null && <p className="text-xs">Precio de compra{multiple ? " promedio" : ""}: ${numero(p.precio)} CLP por {unidad} · Costo total: ${numero(p.costo_total ?? comprada * p.precio)} CLP</p>}
    {p.precio === null && <p className="text-xs text-muted-foreground">{comprada > 0 ? "Precio pendiente de revisión de unidad o presentación." : "Sin compra registrada."}</p>}
    {p.requiere_ajuste && <p role="status" className="text-xs text-amber-800">La demanda cambió. Revisa las compras históricas; solo consideramos hasta {formato(p.requerida)} para la utilidad. No se modificaron las compras.</p>}
    {!verificable && <p className="text-xs text-amber-800">Unidad o presentación histórica sin verificar. Registro bloqueado.</p>}
    {p.compras && <ul className="space-y-1 text-xs">{p.compras.map(c => <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded border p-2"><span>{formato(c.cantidad_asignada)} × ${numero(c.precio_compra)} = ${numero(c.cantidad_asignada * c.precio_compra)} CLP</span><button type="button" disabled={pendiente || !verificable} aria-controls={id} aria-expanded={abierto && edicion?.id === c.id} onClick={() => abrir(c)} className="rounded border px-2 py-1">Editar compra</button></li>)}</ul>}
    <div id={id} inert={!abierto} aria-hidden={!abierto} className={`grid transition-[grid-template-rows,opacity] duration-150 motion-reduce:transition-none ${abierto ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}><div className="overflow-hidden">
    {idCompra !== "" || !multiple ? <form className="space-y-3 rounded-lg bg-muted/40 p-3" action={(datos) => iniciar(async () => {
      setMensaje("");
      try {
        const resultado = await guardarCompraDia(datos);
        setMensaje(resultado.error ?? "Compra guardada.");
        if (resultado.guardado) setAbierto(false);
      } catch { setMensaje("No se pudo confirmar el guardado. Recarga para verificar antes de reintentar."); }
    })}>
      <input type="hidden" name="fecha" value={fecha} /><input type="hidden" name="clave" value={p.clave} /><input type="hidden" name="revision" value={p.revision} /><input type="hidden" name="version" value={multiple ? edicion?.version ?? 0 : p.version} /><input type="hidden" name="contrato" value={multiple ? "2" : "1"} /><input type="hidden" name="compra_id" value={idCompra} />
      {!edicion && <div className="flex gap-2 text-xs"><button type="button" className="rounded border p-2" onClick={() => setCantidad(String(maximo))}>Compra completa</button><button type="button" className="rounded border p-2" onClick={() => setCantidad("")}>Compra parcial</button></div>}
      <label className="block text-xs">Precio de compra · CLP por {unidad}<input className="mt-1 block w-full rounded border bg-background p-2" name="precio" type="number" min="0" max="999999999.999" step="0.001" required value={precio} onChange={e => setPrecio(e.target.value)} disabled={pendiente} /></label>
      <label className="block text-xs">Cantidad comprada · {unidad}<input className="mt-1 block w-full rounded border bg-background p-2" name="cantidad" type="number" min={edicion || !multiple ? "0" : p.modo === "kg_fraccionable" ? "0.001" : "1"} max={Math.min(maximo, 999999999.999)} step={p.modo === "kg_fraccionable" ? "0.001" : "1"} required value={cantidad} onChange={e => setCantidad(e.target.value)} disabled={pendiente} /></label>
      <p className="text-xs">Máximo: {formato(maximo)}.{!multiple && " Esta instalación permite una sola compra por producto. Editar reemplaza su total; las compras independientes estarán disponibles tras instalar el parche manual."}{edicion && " Para dejar sin efecto esta compra, guarda cantidad 0; se conserva su auditoría."}</p>
      <div className="flex gap-2"><button disabled={pendiente} className="rounded-md border bg-background px-3 py-2 text-xs disabled:opacity-50">{pendiente ? "Guardando…" : "Guardar compra"}</button><button type="button" disabled={pendiente} onClick={() => setAbierto(false)} className="rounded border px-3 py-2 text-xs">Cerrar</button></div>
    </form> : null}</div></div>
    <p role="status" className="text-xs">{mensaje}</p>
  </li>;
}
