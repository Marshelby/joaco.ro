"use client";

import { useId, useState, useTransition } from "react";
import { bloqueJornada, importeJornada, tonoJornada } from "@/components/admin/jornada-colores";
import { totalCompraCLP } from "@/lib/admin/compra-importes";
import { guardarCompraDia } from "@/app/(admin)/admin/rutas/compra-actions";

export type CompraDia = { id: string; cantidad_asignada: number; precio_compra: number; version: number; actualizado_en: string; proveedor_id?: string | null; estado?: string; pagado?: number; total_contable?: number };
export type ProductoCompraDia = {
  clave: string; clave_operativa: string | null; requiere_ajuste: boolean; producto: string; presentacion: string | null; unidad: string;
  modo: string; requerida: number; revision: string; asignada: number | null;
  precio: number | null; version: number; actualizado: string | null;
  compras?: CompraDia[]; comprada?: number; costo_total?: number | null;
  venta?: number; venta_reconocida?: number | null; sin_desglose?: number;
};
const numero = (n: number) => new Intl.NumberFormat("es-CL", { maximumFractionDigits: 3 }).format(n);

export function DayPurchaseRow({ producto: p, fecha, proveedores }: { producto: ProductoCompraDia; fecha: string; proveedores?: { id: string; nombre: string }[] }) {
  const [abierto, setAbierto] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [pendiente, iniciar] = useTransition();
  const [edicion, setEdicion] = useState<CompraDia | null>(null);
  const [idCompra, setIdCompra] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [precio, setPrecio] = useState("");
  const [proveedor, setProveedor] = useState("");
  const [estado, setEstado] = useState("por_pagar");
  const [abonado, setAbonado] = useState("");
  const total = totalCompraCLP(cantidad, precio) ?? 0;
  const pagado = !proveedor || estado === "por_pagar" ? 0 : estado === "pagado" ? total : Number(abonado);
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
    setProveedor(compra?.proveedor_id ?? "");
    setEstado(compra?.estado ?? "por_pagar");
    setAbonado(String(compra?.pagado ?? ""));
    setIdCompra(compra?.id ?? (multiple ? crypto.randomUUID() : ""));
    setCantidad(String(compra?.cantidad_asignada ?? (multiple ? faltan : p.asignada ?? p.requerida)));
    setPrecio(String(compra?.precio_compra ?? (multiple ? "" : p.precio ?? "")));
    setAbierto(true);
  }
  return <li className="min-w-0 space-y-2 border-b py-3">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div><h3 className="text-sm font-medium">{p.producto}</h3><p className="text-xs text-muted-foreground">{p.presentacion ?? "Sin presentación histórica"} · {p.unidad}</p></div>
      <button type="button" disabled={!verificable || pendiente} aria-expanded={abierto} aria-controls={id} onClick={() => abierto ? setAbierto(false) : abrir(multiple && comprada >= p.requerida ? p.compras?.[0] ?? null : null)} className="max-w-full rounded-md border px-2 py-1 text-xs disabled:opacity-50">{multiple ? (comprada >= p.requerida && p.compras?.length ? "Editar compra" : comprada > 0 && faltan > 0 ? "Registrar compra restante" : "Registrar compra") : p.version ? "Editar compra" : "Registrar compra"}</button>
    </div>
    <dl className="grid grid-cols-2 gap-1.5 text-xs min-[400px]:grid-cols-3">
      {[
        ["Necesitamos", formato(p.requerida), tonoJornada.planificado],
        ["Compramos", formato(comprada), tonoJornada.completado],
        ["Faltan", formato(faltan), faltan > 0 ? tonoJornada.pendiente : tonoJornada.informativo],
      ].map(([titulo, valor, tono]) => <div key={titulo} className={`${bloqueJornada} ${tono}`}>
        <dt>{titulo}</dt><dd className="mt-0.5 font-semibold tabular-nums">{valor}</dd>
      </div>)}
    </dl>
    {p.precio !== null && <p className="text-xs">Precio de compra{multiple ? " promedio" : ""}: ${numero(p.precio)} CLP por {unidad} · <span className={`${importeJornada} ${tonoJornada.informativo}`}>Costo total: ${numero(p.costo_total ?? comprada * p.precio)} CLP</span></p>}
    {p.precio === null && <p className={`${bloqueJornada} text-xs ${comprada > 0 ? tonoJornada.pendiente : tonoJornada.informativo}`}>{comprada > 0 ? "Precio pendiente de revisión de unidad o presentación." : "Sin compra registrada."}</p>}
    {p.requiere_ajuste && <p role="status" className={`${bloqueJornada} text-xs ${tonoJornada.pendiente}`}>La demanda cambió. Revisa las compras históricas; solo consideramos hasta {formato(p.requerida)} para la utilidad. No se modificaron las compras.</p>}
    {!verificable && <p className={`${bloqueJornada} text-xs ${tonoJornada.informativo}`}>Unidad o presentación histórica sin verificar. Registro bloqueado.</p>}
    {p.compras && <ul className="space-y-1 text-xs">{p.compras.map(c => (
      <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded border p-2">
        <span className="min-w-0 wrap-break-word">
          <span className={`${importeJornada} ${tonoJornada.completado}`}>{formato(c.cantidad_asignada)}</span>
          {" × $"}{numero(c.precio_compra)}{" = "}
          <span className={`${importeJornada} ${tonoJornada.informativo}`}>${numero(c.cantidad_asignada * c.precio_compra)} CLP</span>
          {proveedores && <span className="mt-1 block text-muted-foreground">
            {proveedores.find(v => v.id === c.proveedor_id)?.nombre ?? "Sin proveedor"}
            {c.proveedor_id ? <>
              {" · "}<span className={`${importeJornada} ${tonoJornada.completado}`}>Pagado: ${numero(c.pagado ?? 0)}</span>
              {" · "}<span className={`${importeJornada} ${(c.total_contable ?? 0) > (c.pagado ?? 0) ? tonoJornada.pendiente : tonoJornada.informativo}`}>Pendiente: ${numero((c.total_contable ?? 0) - (c.pagado ?? 0))}</span>
            </> : ""}
          </span>}
        </span>
        <button type="button" disabled={pendiente || !verificable} aria-controls={id} aria-expanded={abierto && edicion?.id === c.id} onClick={() => abrir(c)} className="rounded border px-2 py-1">Editar compra</button>
      </li>
    ))}</ul>}
    <div id={id} inert={!abierto} aria-hidden={!abierto} className={`grid transition-[grid-template-rows,opacity] duration-150 motion-reduce:transition-none ${abierto ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}><div className="overflow-hidden">
    {idCompra !== "" || !multiple ? <form className="space-y-3 rounded-lg bg-muted/40 p-3" action={(datos) => iniciar(async () => {
      setMensaje("");
      try {
        const resultado = await guardarCompraDia(datos);
        setMensaje(resultado.error ?? "Compra guardada.");
        if (resultado.guardado) setAbierto(false);
      } catch { setMensaje("No se pudo confirmar el guardado. Recarga para verificar antes de reintentar."); }
    })}>
      <input type="hidden" name="fecha" value={fecha} /><input type="hidden" name="clave" value={p.clave} /><input type="hidden" name="revision" value={p.revision} /><input type="hidden" name="version" value={multiple ? edicion?.version ?? 0 : p.version} /><input type="hidden" name="contrato" value={proveedores ? "3" : multiple ? "2" : "1"} /><input type="hidden" name="compra_id" value={idCompra} />
      {!edicion && <div className="flex gap-2 text-xs"><button type="button" className="rounded border p-2" onClick={() => setCantidad(String(maximo))}>Compra completa</button><button type="button" className="rounded border p-2" onClick={() => setCantidad("")}>Compra parcial</button></div>}
      <label className="block text-xs">Precio de compra · CLP por {unidad}<input className="mt-1 block w-full rounded border bg-background p-2" name="precio" type="number" min="0" max="999999999.999" step="0.001" required value={precio} onChange={e => setPrecio(e.target.value)} disabled={pendiente} /></label>
      <label className="block text-xs">Cantidad comprada · {unidad}<input className="mt-1 block w-full rounded border bg-background p-2" name="cantidad" type="number" min={edicion || !multiple ? "0" : p.modo === "kg_fraccionable" ? "0.001" : "1"} max={Math.min(maximo, 999999999.999)} step={p.modo === "kg_fraccionable" ? "0.001" : "1"} required value={cantidad} onChange={e => setCantidad(e.target.value)} disabled={pendiente} /></label>
      {proveedores && <>
        <label className="block text-xs">Proveedor<select name="proveedor" className="mt-1 block w-full rounded border bg-background p-2" value={proveedor} disabled={pendiente} onChange={e => { setProveedor(e.target.value); setEstado("por_pagar"); setAbonado(""); }}><option value="">Sin proveedor</option>{proveedores.map(v => <option key={v.id} value={v.id}>{v.nombre}</option>)}</select></label>
        {proveedor && <><label className="block text-xs">Estado del pago<select name="estado" className="mt-1 block w-full rounded border bg-background p-2" value={estado} disabled={pendiente} onChange={e => setEstado(e.target.value)}><option value="por_pagar">Por pagar</option><option value="pagado">Pagado completamente</option><option value="parcial">Abono parcial</option></select></label>{estado === "parcial" && <label className="block text-xs">Monto abonado acumulado · CLP<input name="abonado" className="mt-1 block w-full rounded border bg-background p-2" type="number" min={Math.max(1, edicion?.pagado ?? 0)} max={total - 1} step="1" required value={abonado} disabled={pendiente} onChange={e => setAbonado(e.target.value)} /></label>}</>}
        <p className="text-xs"><span className={`${importeJornada} ${tonoJornada.informativo}`}>Total de compra: ${numero(total)} CLP</span> · <span className={`${importeJornada} ${tonoJornada.completado}`}>Pagado: ${numero(pagado)} CLP</span> · <span className={`${importeJornada} ${proveedor && total > pagado ? tonoJornada.pendiente : tonoJornada.informativo}`}>Saldo pendiente: ${numero(proveedor ? total - pagado : 0)} CLP</span>.</p>
        <p className="text-xs text-muted-foreground">{proveedor ? "El total contable se redondea al peso. Los abonos son acumulados: aumentar el monto registra solo la diferencia. Los pagos ya registrados se conservan y bloquean cambios incompatibles." : "Sin proveedor: no genera deuda ni movimientos contables."}</p>
      </>}
      <p className="text-xs">Máximo: {formato(maximo)}.{!multiple && " Esta instalación permite una sola compra por producto. Editar reemplaza su total; las compras independientes estarán disponibles tras instalar el parche manual."}{edicion && " Para dejar sin efecto esta compra, guarda cantidad 0; se conserva su auditoría."}</p>
      <div className="flex gap-2"><button disabled={pendiente} className="rounded-md border bg-background px-3 py-2 text-xs disabled:opacity-50">{pendiente ? "Guardando…" : "Guardar compra"}</button><button type="button" disabled={pendiente} onClick={() => setAbierto(false)} className="rounded border px-3 py-2 text-xs">Cerrar</button></div>
    </form> : null}</div></div>
    <p role="status" className="text-xs">{mensaje}</p>
  </li>;
}
