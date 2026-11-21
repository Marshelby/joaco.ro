"use client";

import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { actualizarProveedor, crearProveedor, registrarMovimientoProveedor, verProveedor } from "@/app/(admin)/admin/proveedores/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  bloqueJornada,
  encabezadoProductoJornada,
  importeJornada,
  presentacionProductoJornada,
  tonoJornada,
} from "@/components/admin/jornada-colores";
import { formatCLP, formatDateCL, formatDateTimeCL } from "@/lib/formatters";
import type { ProveedorDetalle } from "@/lib/admin/proveedores";

const botonMovimiento = "h-auto min-h-11 w-full min-w-0 whitespace-normal break-words py-2 text-center sm:w-auto";

const panel = "min-w-0 rounded-xl border border-border bg-background/50 p-3";
const filaHistorial = "min-w-0 space-y-2 rounded-lg border border-border bg-card p-2.5 text-sm";
const encabezadoHistorial = "flex flex-wrap items-start justify-between gap-x-3 gap-y-1";
const fechaHistorial = "text-xs tabular-nums text-muted-foreground";

const campo = "mt-1 min-h-11 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-70";

export function SupplierDialog({ proveedorId }: { proveedorId?: string }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [detalle, setDetalle] = useState<ProveedorDetalle | null>(null);
  const [tipo, setTipo] = useState<"deuda" | "abono" | null>(null);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [pendiente, iniciar] = useTransition();
  const [bloqueado, setBloqueado] = useState(false);
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [telefono, setTelefono] = useState("");
  const [direccion, setDireccion] = useState("");
  const [editando, setEditando] = useState(false);
  const [monto, setMonto] = useState("");
  const [comentario, setComentario] = useState("");
  const clave = useRef<string | null>(null);
  const enviando = useRef(false);
  const [lecturaPendiente, setLecturaPendiente] = useState(false);

  async function cargar() {
    if (!proveedorId) return;
    const resultado = await verProveedor(proveedorId);
    if (resultado.ok) { setDetalle(resultado.dato); setLecturaPendiente(false); }
    else { setError(resultado.error); setLecturaPendiente(true); }
  }

  function cambiarAbierto(valor: boolean) {
    if (enviando.current || pendiente) return;
    setAbierto(valor);
    if (valor && proveedorId) {
      setError("");
      setAviso("");
      if (!bloqueado) { setEditando(false); setTipo(null); }
      setDetalle(null);
      setLecturaPendiente(true);
      iniciar(cargar);
    }
  }

  function guardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (enviando.current) return;
    enviando.current = true;
    clave.current ??= crypto.randomUUID();
    const operacion = clave.current;
    setError(""); setAviso(""); setBloqueado(true);
    iniciar(async () => {
      try {
        const resultado = proveedorId && editando
          ? await actualizarProveedor(proveedorId, nombre, descripcion, telefono, direccion)
          : proveedorId && tipo
          ? await registrarMovimientoProveedor(operacion, proveedorId, tipo, monto, comentario)
          : await crearProveedor(operacion, nombre, descripcion, telefono, direccion);
        if (!resultado.ok) {
          setError(resultado.error);
          if (resultado.corregible) { setBloqueado(false); clave.current = null; }
          return;
        }
        clave.current = null;
        setBloqueado(false);
        setTipo(null); setMonto(""); setComentario("");
        if (proveedorId) {
          setAviso(editando ? "Datos del proveedor actualizados correctamente." : tipo === "deuda" ? "Deuda con proveedor registrada. Aumentó el monto que Hidro Leufú le debe al proveedor." : "Pago al proveedor registrado. Disminuyó el monto que Hidro Leufú le debe al proveedor.");
          setEditando(false);
          setLecturaPendiente(true);
          await cargar();
        } else {
          setNombre(""); setDescripcion(""); setTelefono(""); setDireccion(""); setAbierto(false);
        }
        router.refresh();
      } catch {
        setError("No se pudo confirmar la respuesta. Reintenta con los mismos datos; la confirmación se conserva para evitar duplicados.");
      } finally { enviando.current = false; }
    });
  }

  return <Dialog.Root open={abierto} onOpenChange={cambiarAbierto}>
    <Dialog.Trigger type="button" className={buttonVariants({ variant: proveedorId ? "outline" : "default" })}>
      {proveedorId ? "Ver proveedor" : "Crear proveedor"}
    </Dialog.Trigger>
    <Dialog.Portal>
      <Dialog.Backdrop className="motion-dialog-backdrop fixed inset-0 z-50 bg-foreground/25" />
      <Dialog.Viewport className="fixed inset-0 z-50 flex overflow-hidden items-end justify-center p-2 sm:items-center sm:p-4">
        <Dialog.Popup className={`motion-dialog-content ${proveedorId ? "max-w-3xl" : "max-w-lg"} flex max-h-[calc(100dvh-1rem)] min-h-0 w-full flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xl outline-none sm:max-h-[85dvh]`} aria-busy={pendiente}>
          <div className="flex shrink-0 items-start justify-between gap-2 border-b border-border bg-muted/25 px-3 py-2 sm:px-4">
            <div className="min-w-0"><Dialog.Title className="wrap-anywhere text-lg font-semibold tracking-tight">{proveedorId ? detalle?.nombre ?? (pendiente ? "Cargando proveedor…" : "Proveedor no disponible") : "Crear proveedor"}</Dialog.Title><Dialog.Description className="mt-0.5 text-sm text-muted-foreground">{proveedorId ? "Cuenta corriente e historial completo de movimientos." : "Registra el nombre y, opcionalmente, descripción, teléfono y dirección."}</Dialog.Description></div>
            <Dialog.Close disabled={pendiente} type="button" aria-label="Cerrar" className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"><X className="size-5" aria-hidden="true" /></Dialog.Close>
          </div>
          <div className="min-h-0 space-y-3 overflow-y-auto overscroll-contain p-3 wrap-anywhere sm:p-4">
            {aviso ? <p role="status" className={`${bloqueJornada} ${tonoJornada.completado} text-sm`}>{aviso}</p> : null}
            {error ? <p role="alert" className="rounded-lg border border-destructive/25 bg-destructive/5 p-3 text-sm text-destructive">{error}</p> : null}
            {proveedorId && lecturaPendiente ? <div role="status" className={`${panel} space-y-2`}><p className="text-sm text-muted-foreground">{pendiente ? "Cargando proveedor…" : "Actualiza la información antes de registrar otro movimiento."}</p>{!pendiente ? <Button variant="outline" onClick={() => { setError(""); iniciar(cargar); }}>Reintentar consulta</Button> : null}</div> : null}
            {detalle && !lecturaPendiente ? (
              <section className={panel} aria-label="Cuenta del proveedor">
                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(9rem,0.48fr)] sm:items-start">
                  <div className="min-w-0 space-y-1">
                    <p className="whitespace-pre-wrap text-sm text-muted-foreground">{detalle.descripcion || "Sin descripción"}</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                      <p>Teléfono: {detalle.telefono || "Sin teléfono"}</p>
                      <p className="whitespace-pre-wrap">Dirección: {detalle.direccion || "Sin dirección"}</p>
                    </div>
                  </div>
                  <dl className={`rounded-lg border px-3 py-2 ${detalle.saldo_actual > 0 ? tonoJornada.incidencia : tonoJornada.completado}`}>
                    <dt className="text-xs font-medium">Saldo vigente</dt>
                    <dd>
                      <span className="block text-lg leading-tight font-semibold tabular-nums">{detalle.saldo_actual === 0 ? "—" : formatCLP(Math.abs(detalle.saldo_actual))}</span>
                      <span className="block text-xs">{detalle.saldo_actual > 0 ? "Le debemos" : detalle.saldo_actual < 0 ? "Nos debe" : "Cuenta al día"}</span>
                    </dd>
                  </dl>
                </div>
                {!tipo && !editando ? (
                  <div className="mt-2 grid gap-2 border-t border-border pt-2 sm:flex sm:flex-wrap">
                    <Button className={`${botonMovimiento} ${tonoJornada.incidencia} hover:bg-[#FEE2E2]`} disabled={pendiente} onClick={() => { setTipo("deuda"); setError(""); setAviso(""); }}>Registrar deuda con proveedor</Button>
                    <Button className={`${botonMovimiento} ${tonoJornada.completado} hover:bg-[#DCFCE7]`} disabled={pendiente} onClick={() => { setTipo("abono"); setError(""); setAviso(""); }}>Registrar pago al proveedor</Button>
                    <Button className={botonMovimiento} disabled={pendiente || bloqueado} variant="outline" onClick={() => { setNombre(detalle.nombre); setDescripcion(detalle.descripcion ?? ""); setTelefono(detalle.telefono?.slice(4) ?? ""); setDireccion(detalle.direccion ?? ""); setEditando(true); setError(""); setAviso(""); }}>Editar datos</Button>
                  </div>
                ) : null}
              </section>
            ) : null}
            {(!proveedorId || ((tipo || editando) && detalle && !lecturaPendiente)) ? <form onSubmit={guardar} className={`${panel} space-y-2.5`}>
              <h2 className="border-b border-border pb-2 text-sm font-semibold">{editando ? "Editar datos del proveedor" : proveedorId ? tipo === "deuda" ? "Registrar deuda con proveedor" : "Registrar pago al proveedor" : "Datos del proveedor"}</h2>
              {proveedorId && !editando ? <>
                <p className="text-sm text-muted-foreground">{tipo === "deuda" ? "Registra un monto que Hidro Leufú debe al proveedor. Este movimiento aumenta lo que le debemos; si hay saldo a favor, primero lo reduce." : "Registra dinero que Hidro Leufú pagó al proveedor. Este movimiento disminuye lo que le debemos. No puede superar la deuda manual pendiente ni generar saldo a favor."}</p>
                <label className="block text-sm font-medium">{tipo === "deuda" ? "Monto de la deuda en pesos (sin decimales)" : "Monto del pago al proveedor en pesos (sin decimales)"}<input className={campo} type="number" min="1" max="999999999999" step="1" required value={monto} disabled={bloqueado || pendiente} onChange={(e) => setMonto(e.target.value)} /></label>
                <label className="block text-sm font-medium">{tipo === "deuda" ? "Motivo de la deuda (obligatorio)" : "Detalle del pago al proveedor (obligatorio)"}<textarea rows={2} className={`${campo} block resize-y`} required maxLength={2000} value={comentario} disabled={bloqueado || pendiente} onChange={(e) => setComentario(e.target.value)} /></label>
                <p className={`${bloqueJornada} ${tonoJornada.informativo} text-xs leading-5`}>Estos formularios registran deudas manuales y sus pagos. Para pagar una compra registrada, edítala en Rutas e indica el pago acumulado. «Le debemos» indica dinero que Hidro Leufú debe al proveedor; «Nos debe» indica saldo a favor de Hidro Leufú; «Cuenta al día» indica que no hay deuda ni saldo a favor. Al confirmar, el movimiento queda registrado de forma permanente. Las correcciones se registran con un nuevo movimiento.</p>
              </> : <>
                <label className="block min-w-0 text-sm font-medium">Nombre obligatorio<input className={campo} required maxLength={200} value={nombre} disabled={bloqueado || pendiente} onChange={(e) => setNombre(e.target.value)} /></label>
                <label className="block text-sm font-medium">Descripción opcional<textarea rows={2} className={`${campo} block resize-y`} maxLength={2000} value={descripcion} disabled={bloqueado || pendiente} onChange={(e) => setDescripcion(e.target.value)} /></label>
                <label className="block text-sm font-medium">Teléfono opcional<span className="mt-1 flex items-center overflow-hidden rounded-lg border border-border bg-background focus-within:ring-2 focus-within:ring-ring/50"><span className="flex min-h-11 shrink-0 items-center border-r border-border bg-muted/50 px-3 text-muted-foreground">+569</span><input className="min-h-11 min-w-0 flex-1 bg-transparent px-3 py-2 text-sm outline-none disabled:opacity-70" type="tel" inputMode="numeric" pattern="[0-9]{8}" maxLength={8} placeholder="12345678" aria-label="Teléfono opcional: 8 dígitos después de +569" value={telefono} disabled={bloqueado || pendiente} onChange={(e) => setTelefono(e.target.value)} /></span><span className="mt-1 block text-xs text-muted-foreground">Escribe exactamente 8 dígitos o deja el campo vacío.</span></label>
                <label className="block text-sm font-medium">Dirección opcional<textarea rows={2} className={`${campo} block resize-y`} maxLength={2000} value={direccion} disabled={bloqueado || pendiente} onChange={(e) => setDireccion(e.target.value)} /></label>
              </>}
              {bloqueado && !pendiente ? <p className="text-sm text-muted-foreground">Se conserva esta confirmación y sus datos. Reintentar no duplicará un registro ya recibido.</p> : null}
              <div className="flex flex-wrap gap-2 border-t border-border pt-2"><Button className={botonMovimiento} type="submit" disabled={pendiente}>{pendiente ? "Guardando…" : bloqueado ? "Reintentar confirmación" : proveedorId && !editando ? tipo === "deuda" ? "Confirmar deuda con proveedor" : "Confirmar pago al proveedor" : "Confirmar registro"}</Button>{(tipo || editando) && !bloqueado ? <Button type="button" variant="outline" disabled={pendiente} onClick={() => { setEditando(false); setTipo(null); setMonto(""); setComentario(""); }}>Cancelar</Button> : null}</div>
            </form> : null}
            {detalle?.compras && !lecturaPendiente ? (
              <section className={`${panel} space-y-2`}>
                <div>
                  <h2 className="font-semibold tracking-tight">Historial de compras</h2>
                  <p className="text-xs text-muted-foreground">Incluidas una sola vez en el saldo global. Pagos acumulados por compra; conserva compras anteriores y anuladas.</p>
                </div>
                {detalle.compras.length ? (
                  <ul className="space-y-2">
                    {detalle.compras.map((c) => (
                      <li key={c.id} className={filaHistorial}>
                        <div className={encabezadoHistorial}>
                          <div className={c.producto_snapshot ? encabezadoProductoJornada : `${bloqueJornada} ${tonoJornada.informativo}`}>
                            <h3 className="font-semibold">{c.producto_snapshot ?? "Producto histórico"}</h3>
                            {c.presentacion_snapshot ? <p className={c.producto_snapshot ? presentacionProductoJornada : "text-xs"}>{c.presentacion_snapshot}</p> : null}
                          </div>
                          <time dateTime={c.fecha} className={fechaHistorial}>{formatDateCL(c.fecha)}</time>
                        </div>
                        <dl className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,7rem),1fr))] gap-1.5 text-xs tabular-nums">
                          <div className={`${bloqueJornada} ${tonoJornada.planificado}`}>
                            <dt>Cantidad</dt><dd className="font-semibold">{c.cantidad_asignada} {c.unidad}</dd>
                          </div>
                          <div className={`${bloqueJornada} ${tonoJornada.venta}`}>
                            <dt>Precio unitario</dt><dd className="font-semibold">{formatCLP(c.precio_compra)}</dd>
                          </div>
                          <div className={`${bloqueJornada} ${tonoJornada.venta}`}>
                            <dt>Total</dt><dd className="font-semibold">{formatCLP(c.total)}</dd>
                          </div>
                          <div className={`${bloqueJornada} ${c.pagado > 0 ? tonoJornada.completado : tonoJornada.informativo}`}>
                            <dt>Pagos acumulados</dt><dd className="font-semibold">{formatCLP(c.pagado)}</dd>
                          </div>
                          <div className={`${bloqueJornada} ${c.saldo > 0 ? tonoJornada.pendiente : c.saldo === 0 ? tonoJornada.completado : tonoJornada.informativo}`}>
                            <dt>Pendiente de compra</dt><dd className="font-semibold">{formatCLP(c.saldo)}</dd>
                          </div>
                        </dl>
                        <p className="text-xs text-muted-foreground">Administrador: {c.administrador_nombre ?? "Administrador no disponible"}</p>
                      </li>
                    ))}
                  </ul>
                ) : <p className="text-sm text-muted-foreground">Sin compras vinculadas.</p>}
              </section>
            ) : null}
            {detalle?.asientos_compras && !lecturaPendiente ? (
              <section className={`${panel} space-y-2`}>
                <h2 className="font-semibold tracking-tight">Obligaciones, ajustes y pagos de compras</h2>
                {detalle.asientos_compras.length ? (
                  <ol className="space-y-2">
                    {detalle.asientos_compras.map((a) => {
                      const producto = detalle.compras?.find((c) => c.id === a.compra_id)?.producto_snapshot;
                      return (
                        <li key={a.id} className={filaHistorial}>
                          <div className={encabezadoHistorial}>
                            <p className="font-semibold">{a.concepto === "pago" ? "Pago de compra" : a.importe < 0 ? "Disminución de obligación de compra" : "Obligación / aumento de compra"}</p>
                            <time dateTime={a.fecha} className={fechaHistorial}>{formatDateTimeCL(a.fecha)}</time>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className={producto ? `${encabezadoProductoJornada} text-xs font-semibold` : `${importeJornada} ${tonoJornada.informativo} text-xs`}>{producto ?? "Compra histórica"}</p>
                            <p className={`${importeJornada} ${a.concepto === "pago" ? tonoJornada.completado : tonoJornada.venta} text-xs`}>Importe: {formatCLP(Math.abs(a.importe))}</p>
                          </div>
                          <p className="text-xs text-muted-foreground">Versión {a.version} · Administrador: {a.administrador_nombre ?? "Administrador no disponible"}</p>
                        </li>
                      );
                    })}
                  </ol>
                ) : <p className="text-sm text-muted-foreground">Sin obligaciones, ajustes ni pagos de compras registrados.</p>}
              </section>
            ) : null}
            {detalle && !lecturaPendiente ? (
              <section className={`${panel} space-y-2`}>
                <div>
                  <h2 className="font-semibold tracking-tight">Historial de movimientos manuales</h2>
                  <p className="text-xs text-muted-foreground">Orden cronológico: del más antiguo al más reciente.</p>
                </div>
                {detalle.movimientos.length ? (
                  <ol className="space-y-2">
                    {detalle.movimientos.map((m) => (
                      <li key={m.id} className={filaHistorial}>
                        <div className={encabezadoHistorial}>
                          <p className={`${importeJornada} ${m.tipo === "deuda" ? tonoJornada.incidencia : tonoJornada.completado}`}>
                            {m.tipo === "deuda" ? "Deuda con proveedor" : "Pago al proveedor"} · {formatCLP(m.monto)}
                          </p>
                          <time dateTime={m.fecha} className={fechaHistorial}>{formatDateTimeCL(m.fecha)}</time>
                        </div>
                        <p className="whitespace-pre-wrap">{m.comentario}</p>
                        <p className="text-xs text-muted-foreground">Administrador: {m.administrador_nombre}</p>
                      </li>
                    ))}
                  </ol>
                ) : <p className="text-sm text-muted-foreground">Sin movimientos registrados.</p>}
              </section>
            ) : null}
          </div>
        </Dialog.Popup>
      </Dialog.Viewport>
    </Dialog.Portal>
  </Dialog.Root>;
}
