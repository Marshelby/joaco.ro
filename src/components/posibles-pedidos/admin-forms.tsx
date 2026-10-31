"use client";
import { useActionState, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { operarPosiblePedido, type EstadoOperacionPosible } from "@/app/(admin)/admin/posibles-pedidos/actions";
import { huellaSolicitud } from "@/lib/posibles-pedidos/intentos";
import type { ClientePosible, DireccionPosible, LineaPosible, PosiblePedido, PresentacionPosible } from "@/lib/posibles-pedidos/administracion";
import { formatCLP } from "@/lib/formatters";
import { formatFechaEntregaLarga } from "@/lib/delivery-date";
import { Button } from "@/components/ui/button";
export const campoAdmin = "mt-1 min-h-11 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50";
function OperacionForm({ pedido, tipo, titulo, children, peligro = false }: { pedido: PosiblePedido; tipo: string; titulo: string; children: ReactNode; peligro?: boolean }) {
  const router = useRouter();
  const [estado, accion, pendiente] = useActionState(async (_: EstadoOperacionPosible, datos: FormData) => {
    try {
      const huella = await huellaSolicitud(Array.from(datos.entries()));
      const storageKey = `hidro-pp-admin-${huella}`;
      let clave = sessionStorage.getItem(storageKey);
      if (!clave) { clave = crypto.randomUUID(); sessionStorage.setItem(storageKey,clave); }
      datos.set("clave",clave);
      return await operarPosiblePedido({},datos);
    } catch { return { error: "No pudimos verificar la operación. Conserva los datos y vuelve a intentar." }; }
  }, {});
  useEffect(() => { if (estado.exito) router.refresh(); }, [estado, router]);
  return <form action={accion} className="space-y-4 rounded-2xl border border-border bg-card p-5">
    <h3 className="font-semibold">{titulo}</h3><input type="hidden" name="id" value={pedido.id} /><input type="hidden" name="version" value={pedido.version} /><input type="hidden" name="tipo" value={tipo} />
    <fieldset disabled={pendiente || !!estado.exito} className="space-y-4">{children}<Button type="submit" disabled={pendiente || !!estado.exito} variant={peligro ? "destructive" : "default"} className="min-h-11">{pendiente ? "Procesando…" : titulo}</Button></fieldset>
    {estado.error ? <p role="alert" className="text-sm leading-6 text-destructive">{estado.error}</p> : null}{estado.exito ? <p role="status" className="text-sm leading-6 text-primary">{estado.exito}</p> : null}
  </form>;
}
export function EditarPosibleForm({ pedido, lineas, presentaciones }: { pedido: PosiblePedido; lineas: LineaPosible[]; presentaciones: PresentacionPosible[] }) {
  const [editadas, setEditadas] = useState(lineas.map((l) => ({ ...l, cantidad: Number(l.cantidad) })));
  const [nueva, setNueva] = useState(""); const [cantidadNueva, setCantidadNueva] = useState("1");
  const lista = editadas.filter((l) => l.activo).map((l) => ({ item_id: l.id, cantidad: l.cantidad }));
  const nuevas = presentaciones.filter((p) => !lineas.some((l) => l.presentacion_producto_id === p.id));
  return <OperacionForm pedido={pedido} tipo="editar" titulo="Guardar productos y cantidades"><input type="hidden" name="lineas" value={JSON.stringify([...lista,...(nueva ? [{ presentacion_id: nueva, cantidad: Number(cantidadNueva) }] : [])])} />
    <p className="text-sm leading-6 text-muted-foreground">Desmarca para retirar una línea. Reactivarla conserva su precio original. Las líneas nuevas capturan el precio vigente.</p>
    {editadas.map((l,index) => <div key={l.id} className="grid grid-cols-[minmax(0,1fr)_6rem] gap-3 rounded-lg bg-muted/40 p-3"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={l.activo} onChange={(e) => setEditadas(editadas.map((x) => x.id===l.id ? { ...x, activo: e.target.checked } : x))} />{l.nombre_producto_snapshot} · {l.nombre_presentacion_snapshot}</label><label className="text-xs">Cantidad<input aria-label={`Cantidad de ${l.nombre_producto_snapshot}`} type="number" step="0.5" min="0.5" max="100000" disabled={!l.activo} required={l.activo} value={l.cantidad} onChange={(e) => setEditadas(editadas.map((x) => x.id===l.id ? { ...x, cantidad: Number(e.target.value) } : x))} className={campoAdmin} /></label><div className="col-span-2 flex gap-2"><Button type="button" variant="ghost" disabled={index===0} onClick={() => { const copia=[...editadas];[copia[index-1],copia[index]]=[copia[index],copia[index-1]];setEditadas(copia); }}>Subir</Button><Button type="button" variant="ghost" disabled={index===editadas.length-1} onClick={() => { const copia=[...editadas];[copia[index+1],copia[index]]=[copia[index],copia[index+1]];setEditadas(copia); }}>Bajar</Button></div></div>)}
    <label className="block text-sm">Añadir una presentación<select value={nueva} onChange={(e) => setNueva(e.target.value)} className={campoAdmin}><option value="">Sin nueva línea</option>{nuevas.map((p) => <option key={p.id} value={p.id}>{p.productos.nombre} · {p.nombre} · {formatCLP(p.precio_final)}</option>)}</select></label>{nueva ? <label className="block text-sm">Cantidad nueva<input type="number" min="0.5" step="0.5" max="100000" required value={cantidadNueva} onChange={(e) => setCantidadNueva(e.target.value)} className={campoAdmin} /></label> : null}
  </OperacionForm>;
}
export function AsociarPosibleForm({ pedido, clientes }: { pedido: PosiblePedido; clientes: ClientePosible[] }) {
  return <OperacionForm pedido={pedido} tipo="asociar" titulo="Asociar cliente"><label className="block text-sm">Cliente comercial existente<select name="cliente" required defaultValue={pedido.cliente_id ?? ""} className={campoAdmin}><option value="">Selecciona un cliente</option>{clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}{c.telefono ? ` · ${c.telefono}` : ""}</option>)}</select></label><p className="text-xs leading-5 text-muted-foreground">No se crea una cuenta de acceso ni se asocia automáticamente por teléfono. La creación de clientes nuevos requiere un contrato SQL adicional.</p></OperacionForm>;
}
export function PrecioPosibleForm({ pedido, linea }: { pedido: PosiblePedido; linea: LineaPosible }) {
  return <OperacionForm pedido={pedido} tipo="precio" titulo="Autorizar precio"><input type="hidden" name="item" value={linea.id} /><p className="text-sm">{linea.nombre_producto_snapshot} · {linea.nombre_presentacion_snapshot}</p><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">Neto unitario<input name="neto" type="number" min="0" max="9000000000000" step="1" required defaultValue={linea.precio_neto_autorizado ?? linea.precio_neto_original_snapshot} className={campoAdmin} /></label><label className="text-sm">Venta unitaria<input name="venta" type="number" min="0" max="9000000000000" step="1" required defaultValue={linea.precio_venta_autorizado ?? linea.precio_venta_original_snapshot} className={campoAdmin} /></label></div><label className="block text-sm">Motivo de la autorización<textarea name="motivo" required maxLength={1000} rows={2} className={campoAdmin} /></label><p className="text-xs leading-5 text-muted-foreground">La autorización queda registrada con actor, fecha, motivo y precios. El snapshot original permanece intacto.</p></OperacionForm>;
}
export function CerrarPosibleForms({ pedido, direcciones, fechas }: { pedido: PosiblePedido; direcciones: DireccionPosible[]; fechas: string[] }) {
  const validas = direcciones.filter((d) => d.latitud !== null && d.longitud !== null);
  return <div className="grid gap-5 lg:grid-cols-2"><OperacionForm pedido={pedido} tipo="convertir" titulo="Convertir en pedido oficial">
    <p className="text-sm leading-6 text-muted-foreground">Se creará una venta en estado recibido y su cargo en cuenta corriente. No se registrará ningún pago ni se marcará como aceptado.</p>
    <label className="block text-sm">Dirección del cliente asociado<select name="direccion" required className={campoAdmin} defaultValue=""><option value="">Selecciona una dirección con ubicación</option>{validas.map((d) => <option key={d.id} value={d.id}>{d.direccion}, {d.comuna}</option>)}</select></label>
    {!validas.length ? <p className="text-sm text-amber-800">Asocia un cliente y completa una dirección activa con ubicación antes de convertir.</p> : null}
    <label className="block text-sm">Fecha efectiva<select name="fecha" required defaultValue="" className={campoAdmin}><option value="">Selecciona una fecha</option>{fechas.map((f) => <option key={f} value={f}>{formatFechaEntregaLarga(f)}</option>)}</select></label>
    <label className="block text-sm">Forma de pago prevista<select name="metodo" required defaultValue="" className={campoAdmin}><option value="">Selecciona una opción</option><option value="efectivo">Efectivo</option><option value="transferencia">Transferencia</option><option value="tarjeta">Tarjeta</option></select></label>
    <label className="flex items-start gap-3 text-sm leading-6"><input name="confirmacion" type="checkbox" required className="mt-1 size-4 shrink-0 accent-primary" />Confirmo cliente, dirección, productos y precios. Entiendo que convertir crea el pedido oficial y su cargo contable.</label>
  </OperacionForm><OperacionForm pedido={pedido} tipo="descartar" titulo="Descartar solicitud" peligro><p className="text-sm leading-6 text-muted-foreground">Cierra la solicitud sin crear un pedido ni un cargo.</p><label className="block text-sm">Motivo del descarte<textarea name="motivo" required maxLength={1000} rows={3} className={campoAdmin} /></label></OperacionForm></div>;
}
