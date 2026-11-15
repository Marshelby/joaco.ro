"use client";

import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { actualizarProveedor, crearProveedor, registrarMovimientoProveedor, verProveedor } from "@/app/(admin)/admin/proveedores/actions";
import { Button } from "@/components/ui/button";
import { formatCLP, formatDateTimeCL } from "@/lib/formatters";
import type { ProveedorDetalle } from "@/lib/admin/proveedores";

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
          setAviso(editando ? "Datos del proveedor actualizados correctamente." : "Movimiento registrado correctamente.");
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
    <Dialog.Trigger type="button" className={`inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50 ${proveedorId ? "hover:bg-muted" : "bg-primary text-primary-foreground hover:bg-primary/80"}`}>{proveedorId ? "Ver proveedor" : "Crear proveedor"}</Dialog.Trigger>
    <Dialog.Portal>
      <Dialog.Backdrop className="motion-dialog-backdrop fixed inset-0 z-50 bg-foreground/25" />
      <Dialog.Viewport className="fixed inset-0 z-50 flex items-end justify-center p-2 sm:items-center sm:p-4">
        <Dialog.Popup className="motion-dialog-content max-h-[calc(100dvh-1rem)] w-full max-w-4xl overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-xl outline-none sm:max-h-[85vh] sm:p-6" aria-busy={pendiente}>
          <div className="sticky top-0 z-10 -mx-5 -mt-5 flex items-start justify-between gap-4 border-b border-border bg-card px-5 py-4 sm:-mx-6 sm:-mt-6 sm:px-6">
            <div><Dialog.Title className="text-lg font-semibold tracking-tight">{proveedorId ? "Proveedor" : "Crear proveedor"}</Dialog.Title><Dialog.Description className="mt-1 text-sm text-muted-foreground">{proveedorId ? "Cuenta corriente e historial completo de movimientos." : "Registra el nombre y, opcionalmente, descripción, teléfono y dirección."}</Dialog.Description></div>
            <Dialog.Close disabled={pendiente} type="button" aria-label="Cerrar" className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"><X className="size-5" aria-hidden="true" /></Dialog.Close>
          </div>
          <div className="space-y-5 pt-5">
            {aviso ? <p role="status" className="rounded-lg bg-muted p-3 text-sm">{aviso}</p> : null}
            {error ? <p role="alert" className="rounded-lg border border-destructive/25 bg-destructive/5 p-3 text-sm text-destructive">{error}</p> : null}
            {proveedorId && lecturaPendiente ? <div role="status"><p className="text-sm text-muted-foreground">{pendiente ? "Cargando proveedor…" : "Actualiza la información antes de registrar otro movimiento."}</p>{!pendiente ? <Button variant="outline" onClick={() => { setError(""); iniciar(cargar); }}>Reintentar consulta</Button> : null}</div> : null}
            {detalle && !lecturaPendiente ? <>
              <section className="rounded-xl border border-border p-4"><h2 className="text-xl font-semibold">{detalle.nombre}</h2><p className="mt-2 whitespace-pre-wrap break-words text-sm text-muted-foreground">{detalle.descripcion || "Sin descripción"}</p><p className="mt-2 break-words text-sm text-muted-foreground">Teléfono: {detalle.telefono || "Sin teléfono"}</p><p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted-foreground">Dirección: {detalle.direccion || "Sin dirección"}</p><p className="mt-4 text-sm text-muted-foreground">Saldo actual</p><p className="mt-1 text-2xl font-semibold">{formatCLP(detalle.saldo_actual)}</p></section>
              {!tipo && !editando ? <div className="flex flex-wrap gap-3"><Button disabled={pendiente} onClick={() => { setTipo("deuda"); setError(""); setAviso(""); }}>Agregar deuda</Button><Button disabled={pendiente} variant="outline" onClick={() => { setTipo("abono"); setError(""); setAviso(""); }}>Registrar abono</Button><Button disabled={pendiente || bloqueado} variant="outline" onClick={() => { setNombre(detalle.nombre); setDescripcion(detalle.descripcion ?? ""); setTelefono(detalle.telefono?.slice(4) ?? ""); setDireccion(detalle.direccion ?? ""); setEditando(true); setError(""); setAviso(""); }}>Editar datos</Button></div> : null}
            </> : null}
            {(!proveedorId || ((tipo || editando) && detalle && !lecturaPendiente)) ? <form onSubmit={guardar} className="space-y-4 rounded-xl border border-border p-4">
              <h2 className="font-semibold">{editando ? "Editar datos del proveedor" : proveedorId ? tipo === "deuda" ? "Agregar deuda" : "Registrar abono" : "Datos del proveedor"}</h2>
              {proveedorId && !editando ? <>
                <label className="block text-sm font-medium">Monto en pesos (sin decimales)<input className={campo} type="number" min="1" max="999999999999" step="1" required value={monto} disabled={bloqueado || pendiente} onChange={(e) => setMonto(e.target.value)} /></label>
                <label className="block text-sm font-medium">Comentario obligatorio<textarea className={campo} required maxLength={2000} value={comentario} disabled={bloqueado || pendiente} onChange={(e) => setComentario(e.target.value)} /></label>
                <p className="text-sm text-muted-foreground">Los movimientos son permanentes. Las correcciones se registran con un nuevo movimiento. No se admiten abonos superiores al saldo.</p>
              </> : <>
                <label className="block text-sm font-medium">Nombre obligatorio<input className={campo} required maxLength={200} value={nombre} disabled={bloqueado || pendiente} onChange={(e) => setNombre(e.target.value)} /></label>
                <label className="block text-sm font-medium">Descripción opcional<textarea className={campo} maxLength={2000} value={descripcion} disabled={bloqueado || pendiente} onChange={(e) => setDescripcion(e.target.value)} /></label>
                <label className="block text-sm font-medium">Teléfono opcional<span className="mt-1 flex items-center overflow-hidden rounded-lg border border-border bg-background focus-within:ring-2 focus-within:ring-ring/50"><span className="shrink-0 border-r border-border px-3 py-2">+569</span><input className="min-h-11 min-w-0 flex-1 bg-transparent px-3 py-2 text-sm outline-none disabled:opacity-70" type="tel" inputMode="numeric" pattern="[0-9]{8}" maxLength={8} placeholder="12345678" aria-label="Teléfono opcional: 8 dígitos después de +569" value={telefono} disabled={bloqueado || pendiente} onChange={(e) => setTelefono(e.target.value)} /></span><span className="mt-1 block text-xs text-muted-foreground">Escribe exactamente 8 dígitos o deja el campo vacío.</span></label>
                <label className="block text-sm font-medium">Dirección opcional<textarea className={campo} maxLength={2000} value={direccion} disabled={bloqueado || pendiente} onChange={(e) => setDireccion(e.target.value)} /></label>
              </>}
              {bloqueado && !pendiente ? <p className="text-sm text-muted-foreground">Se conserva esta confirmación y sus datos. Reintentar no duplicará un registro ya recibido.</p> : null}
              <div className="flex flex-wrap gap-2"><Button type="submit" disabled={pendiente}>{pendiente ? "Guardando…" : bloqueado ? "Reintentar confirmación" : "Confirmar registro"}</Button>{(tipo || editando) && !bloqueado ? <Button type="button" variant="outline" disabled={pendiente} onClick={() => { setEditando(false); setTipo(null); setMonto(""); setComentario(""); }}>Cancelar</Button> : null}</div>
            </form> : null}
            {detalle && !lecturaPendiente ? <section className="rounded-xl border border-border p-4"><h2 className="text-lg font-semibold">Historial de movimientos</h2><p className="mt-1 text-sm text-muted-foreground">Orden cronológico: del más antiguo al más reciente.</p>{detalle.movimientos.length ? <ol className="mt-4 space-y-3">{detalle.movimientos.map((m) => <li key={m.id} className="rounded-lg bg-muted/50 p-3 text-sm"><div className="flex flex-wrap justify-between gap-2"><p className="font-semibold">{m.tipo === "deuda" ? "Deuda" : "Abono"} · {m.tipo === "deuda" ? "+" : "−"}{formatCLP(m.monto)}</p><time dateTime={m.fecha} className="text-muted-foreground">{formatDateTimeCL(m.fecha)}</time></div><p className="mt-2 whitespace-pre-wrap break-words">{m.comentario}</p><p className="mt-2 break-words text-muted-foreground">Administrador: {m.administrador_nombre} · {m.administrador_id}</p></li>)}</ol> : <p className="mt-3 text-sm text-muted-foreground">Sin movimientos registrados.</p>}</section> : null}
          </div>
        </Dialog.Popup>
      </Dialog.Viewport>
    </Dialog.Portal>
  </Dialog.Root>;
}
