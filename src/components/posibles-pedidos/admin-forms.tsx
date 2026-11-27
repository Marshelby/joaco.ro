"use client";
import { useActionState, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { operarPosiblePedido, type EstadoOperacionPosible } from "@/app/(admin)/admin/posibles-pedidos/actions";
import { huellaSolicitud } from "@/lib/posibles-pedidos/intentos";
import type { ClientePosible, LineaPosible, PosiblePedido, PresentacionPosible } from "@/lib/posibles-pedidos/administracion";
import { OrderQuantityInput } from "@/components/admin/order-quantity-input";
import { isFractionalKgItem } from "@/lib/cart-quantity";
import { formatCLP } from "@/lib/formatters";
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
  const [editadas, setEditadas] = useState(lineas.map((l) => ({ ...l, cantidad: String(l.cantidad) })));
  const [nueva, setNueva] = useState(""); const [cantidadNueva, setCantidadNueva] = useState("1");
  const lista = editadas.filter((l) => l.activo).map((l) => ({ item_id: l.id, cantidad: Number(l.cantidad) }));
  const nuevas = presentaciones.filter((p) => !lineas.some((l) => l.presentacion_producto_id === p.id));
  const seleccionada = nuevas.find((p) => p.id === nueva);
  const formatoNuevo = seleccionada && { unidad: seleccionada.unidad, cantidadPresentacion: Number(seleccionada.cantidad), presentacionNombre: seleccionada.nombre };
  return <OperacionForm pedido={pedido} tipo="editar" titulo="Guardar productos y cantidades">
    <input type="hidden" name="lineas" value={JSON.stringify([...lista, ...(formatoNuevo ? [{ presentacion_id: nueva, cantidad: Number(cantidadNueva) }] : [])])} />
    <p className="text-sm leading-6 text-muted-foreground">Desmarca para retirar una línea. Reactivarla conserva su precio original. Las líneas nuevas capturan el precio vigente.</p>
    {editadas.map((l, index) => {
      const formato = { unidad: l.unidad_snapshot, cantidadPresentacion: Number(l.cantidad_presentacion_snapshot), presentacionNombre: l.nombre_presentacion_snapshot };
      const unidad = isFractionalKgItem(formato) ? "kg" : "presentaciones";
      return <div key={l.id} className="grid sm:grid-cols-[minmax(0,1fr)_11rem] gap-3 rounded-lg bg-muted/40 p-3">
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={l.activo} onChange={(e) => setEditadas(editadas.map((x) => x.id === l.id ? { ...x, activo: e.target.checked } : x))} />{l.nombre_producto_snapshot} · {l.nombre_presentacion_snapshot}</label>
        <div className="text-xs">Cantidad ({unidad})
          <OrderQuantityInput item={formato} label={`Cantidad de ${l.nombre_producto_snapshot} en ${unidad}`}
            disabled={!l.activo} required={l.activo} maximum={100000} value={l.cantidad} className={campoAdmin}
            onValueChange={(valor) => setEditadas(editadas.map((x) => x.id === l.id ? { ...x, cantidad: valor } : x))} />
        </div>
        <div className="flex gap-2 sm:col-span-2"><Button type="button" variant="ghost" disabled={index===0} onClick={() => { const copia=[...editadas];[copia[index-1],copia[index]]=[copia[index],copia[index-1]];setEditadas(copia); }}>Subir</Button><Button type="button" variant="ghost" disabled={index===editadas.length-1} onClick={() => { const copia=[...editadas];[copia[index+1],copia[index]]=[copia[index],copia[index+1]];setEditadas(copia); }}>Bajar</Button></div>
      </div>;
    })}
    <label className="block text-sm">Añadir una presentación<select value={nueva} onChange={(e) => setNueva(e.target.value)} className={campoAdmin}><option value="">Sin nueva línea</option>{nuevas.map((p) => <option key={p.id} value={p.id}>{p.productos.nombre} · {p.nombre} · {formatCLP(p.precio_final)}</option>)}</select></label>
    {formatoNuevo ? <div className="text-sm">Cantidad nueva ({isFractionalKgItem(formatoNuevo) ? "kg" : "presentaciones"})
      <OrderQuantityInput item={formatoNuevo} label={`Cantidad nueva en ${isFractionalKgItem(formatoNuevo) ? "kg" : "presentaciones"}`}
        required maximum={100000} value={cantidadNueva} onValueChange={setCantidadNueva} className={campoAdmin} />
    </div> : null}
  </OperacionForm>;
}
export function AsociarPosibleForm({ pedido, clientes }: { pedido: PosiblePedido; clientes: ClientePosible[] }) {
  return <OperacionForm pedido={pedido} tipo="asociar" titulo="Asociar cliente"><label className="block text-sm">Cliente comercial existente<select name="cliente" required defaultValue={pedido.cliente_id ?? ""} className={campoAdmin}><option value="">Selecciona un cliente</option>{clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}{c.telefono ? ` · ${c.telefono}` : ""}</option>)}</select></label><p className="text-xs leading-5 text-muted-foreground">No se crea una cuenta de acceso ni se asocia automáticamente por teléfono. La creación de clientes nuevos requiere un contrato SQL adicional.</p></OperacionForm>;
}
export function PrecioPosibleForm({ pedido, linea }: { pedido: PosiblePedido; linea: LineaPosible }) {
  return <OperacionForm pedido={pedido} tipo="precio" titulo="Autorizar precio"><input type="hidden" name="item" value={linea.id} /><p className="text-sm">{linea.nombre_producto_snapshot} · {linea.nombre_presentacion_snapshot}</p><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">Neto unitario<input name="neto" type="number" min="0" max="9000000000000" step="1" required defaultValue={linea.precio_neto_autorizado ?? linea.precio_neto_original_snapshot} className={campoAdmin} /></label><label className="text-sm">Venta unitaria<input name="venta" type="number" min="0" max="9000000000000" step="1" required defaultValue={linea.precio_venta_autorizado ?? linea.precio_venta_original_snapshot} className={campoAdmin} /></label></div><label className="block text-sm">Motivo de la autorización<textarea name="motivo" required maxLength={1000} rows={2} className={campoAdmin} /></label><p className="text-xs leading-5 text-muted-foreground">La autorización queda registrada con actor, fecha, motivo y precios. El snapshot original permanece intacto.</p></OperacionForm>;
}
export function DescartarPosibleForm({ pedido }: { pedido: PosiblePedido }) {
  return <OperacionForm pedido={pedido} tipo="descartar" titulo="Descartar solicitud" peligro>
    <p className="text-sm leading-6 text-muted-foreground">Cierra la solicitud sin crear un pedido ni un cargo.</p>
    <label className="block text-sm">Motivo del descarte<textarea name="motivo" required maxLength={1000} rows={3} className={campoAdmin} /></label>
  </OperacionForm>;
}
