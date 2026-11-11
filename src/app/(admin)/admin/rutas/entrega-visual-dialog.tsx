"use client";

import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { useId, useRef, useState } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import type { ItemPreparacionPedidoAdmin } from "@/lib/admin/pedidos";
import { formatearCantidadPreparacionEntrega } from "@/lib/delivery-preparation-quantity";
import { formatCLP } from "@/lib/formatters";

import { useRouter } from "next/navigation";
import { confirmarEntregaTodoCorrecto, revisarCobroEntrega, type BalanceEntrega, type SolicitudConCobro, prepararEntregaTodoCorrecto, type ResumenEntregaTodoCorrecto } from "./entrega-actions";

import { confirmarEntregaDiferencias, prepararEntregaDiferencias, revisarCobroDiferencias } from "./diferencias-actions";

type Props = {
  habilitada: boolean;
  motivoBloqueo: string | null;
  pedidoId: string;
  versionEsperada: number;
  numero: string;
  cliente: string;
  items: readonly ItemPreparacionPedidoAdmin[];
  totalReferencia: number;
};
type Metodo = "efectivo" | "transferencia" | "ambos" | "pendiente";
const campo = "mt-1 min-h-11 w-full rounded-lg border border-input bg-background px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring";
const numeroValido = (valor: string) => valor.trim() !== "" && Number.isFinite(Number(valor)) && Number(valor) >= 0;

export function EntregaVisualDialog(props: Props) {
  const [abierto, setAbierto] = useState(false);
  return <Dialog.Root open={abierto} onOpenChange={setAbierto}>
    <Dialog.Trigger disabled={!props.habilitada} className={buttonVariants({ variant: "outline" })}>Entregado</Dialog.Trigger>
    {props.motivoBloqueo ? <p role="status" className="w-full text-xs text-muted-foreground">{props.motivoBloqueo}</p> : null}
    <Dialog.Portal keepMounted>
      <Dialog.Backdrop className="motion-dialog-backdrop fixed inset-0 z-50 bg-foreground/30" />
      <Dialog.Viewport className="fixed inset-0 z-50 flex items-end justify-center p-2 sm:items-center sm:p-4">
        <ContenidoEntrega {...props} />
      </Dialog.Viewport>
    </Dialog.Portal>
  </Dialog.Root>;
}

function ContenidoEntrega({ habilitada, pedidoId, versionEsperada, numero, cliente, items, totalReferencia: referenciaOriginal }: Props) {
  const id = useId();
  const router = useRouter();
  const bloqueo = useRef(false);
  const intento = useRef<SolicitudConCobro | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [balanceServidor, setBalanceServidor] = useState<BalanceEntrega | null>(null);
  const [exito, setExito] = useState<BalanceEntrega | null>(null);
  async function confirmar() {
    if (!habilitada || bloqueo.current || exito || !resultado || !resumen || !pagoValido || !balanceServidor) return;
    bloqueo.current = true;
    setEnviando(true);
    setEnviado(true);
    setError(null);
    intento.current ??= { ...resumen.solicitud, p_cobro: cobro() };
    try {
      const respuesta = await (diferencias ? confirmarEntregaDiferencias : confirmarEntregaTodoCorrecto)(intento.current);
      if (!respuesta.resultado) { setError(respuesta.error ?? "No fue posible confirmar. Reintenta con la misma solicitud."); return; }
      setExito(respuesta.resultado);
      router.refresh();
    } catch { setError("No se pudo verificar la respuesta. Reintenta con la misma solicitud para evitar duplicados."); }
    finally { bloqueo.current = false; setEnviando(false); }
  }
  function cobro(): SolicitudConCobro["p_cobro"] {
    return { metodo: metodo === "pendiente" ? "por_pagar" : metodo!, efectivo: usaEfectivo ? Number(efectivo) : 0,
      transferencia: usaTransferencia ? Number(transferencia) : 0, confirmar_por_pagar: metodo === "pendiente" && confirmarDeuda };
  }
  const [resumen, setResumen] = useState<ResumenEntregaTodoCorrecto | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paso, setPaso] = useState(1);
  const [resultado, setResultado] = useState<"correcto" | "diferencias" | null>(null);
  const [cantidades, setCantidades] = useState<Record<string, string>>(() => Object.fromEntries(items.map((item) => [item.id, String(item.cantidadPreparada ?? 0)])));
  const [metodo, setMetodo] = useState<Metodo | null>(null);
  const [efectivo, setEfectivo] = useState("");
  const [transferencia, setTransferencia] = useState("");
  const [confirmarDeuda, setConfirmarDeuda] = useState(false);
  const diferencias = resultado === "diferencias";
  const totalReferencia = resumen ? resumen.total : referenciaOriginal;
  const claveDiferencias = useRef<string | null>(null);
  async function continuar() {
    if (bloqueo.current || enviado || cargando) return;
    bloqueo.current = true;
    try {
    if (paso === 1 && resultado && (!resumen || diferencias)) {
      setCargando(true);
      setError(null);
      try {
        if (diferencias) claveDiferencias.current ??= crypto.randomUUID();
        const respuesta = diferencias
          ? await prepararEntregaDiferencias({ p_pedido_id: pedidoId, p_version_esperada: versionEsperada, p_clave: claveDiferencias.current!,
              p_items: items.map(item => ({ item_pedido_id: item.id, cantidad_entregada: Number(cantidades[item.id]) })) })
          : await prepararEntregaTodoCorrecto(pedidoId, versionEsperada);
        if (!respuesta.resumen) { setError(respuesta.error ?? "No fue posible preparar la entrega."); return; }
        // Se conserva el mismo payload (clave, versión y orden) durante esta revisión.
        setResumen(respuesta.resumen);
      } catch { setError("No fue posible leer el resumen. Reintenta."); return; }
      finally { setCargando(false); }
    }
    if (paso === 2 && resultado && resumen) {
      setCargando(true);
      setError(null);
      try {
        const respuesta = await (diferencias ? revisarCobroDiferencias : revisarCobroEntrega)({ ...resumen.solicitud, p_cobro: cobro() });
        if (!respuesta.balance) { setError(respuesta.error ?? "No fue posible revisar el cobro."); return; }
        setBalanceServidor(respuesta.balance);
      } catch { setError("No fue posible revisar el cobro. Reintenta."); return; }
      finally { setCargando(false); }
    }
    setPaso(paso + 1);
    } finally { bloqueo.current = false; }
  }
  const usaEfectivo = metodo === "efectivo" || metodo === "ambos";
  const usaTransferencia = metodo === "transferencia" || metodo === "ambos";
  const recibido = (usaEfectivo && numeroValido(efectivo) ? Number(efectivo) : 0) + (usaTransferencia && numeroValido(transferencia) ? Number(transferencia) : 0);
  const saldo = totalReferencia - recibido;
  function fraccionable(item: ItemPreparacionPedidoAdmin) {
    return item.modoCantidadSnapshot === "kg_fraccionable" || (!item.modoCantidadSnapshot &&
      !/(saco|malla|caja|paquete|docena)/i.test(item.nombrePresentacion ?? "") && item.unidad.trim().toUpperCase() === "KG");
  }
  function cantidadValida(item: ItemPreparacionPedidoAdmin) {
    const texto = cantidades[item.id] ?? "";
    return /^\d+(\.\d{1,3})?$/.test(texto) && Number(texto) < 1e9 && (fraccionable(item) || Number.isInteger(Number(texto)));
  }
  const cantidadesValidas = items.every(cantidadValida) && items.some(item => Number(cantidades[item.id]) !== item.cantidadPreparada);
  const pagoValido = Number.isSafeInteger(recibido) && metodo !== null && (!usaEfectivo || (numeroValido(efectivo) && Number.isSafeInteger(Number(efectivo)) && Number(efectivo) > 0)) && (!usaTransferencia || (numeroValido(transferencia) && Number.isSafeInteger(Number(transferencia)) && Number(transferencia) > 0)) && (metodo !== "pendiente" || confirmarDeuda);

  function elegirMetodo(siguiente: Metodo) {
    if (metodo === siguiente) return;
    // Repartir la referencia sin duplicarla al activar los dos medios.
    const baseEfectivo = usaEfectivo && numeroValido(efectivo) ? Number(efectivo) : 0;
    setEfectivo(siguiente === "efectivo" ? String(totalReferencia) : siguiente === "ambos" ? String(metodo === "transferencia" ? 0 : baseEfectivo || totalReferencia) : "");
    setTransferencia(siguiente === "transferencia" ? String(totalReferencia) : siguiente === "ambos" ? String(metodo === "transferencia" && numeroValido(transferencia) ? Number(transferencia) : Math.max(0, totalReferencia - (baseEfectivo || totalReferencia))) : "");
    setMetodo(siguiente);
    setConfirmarDeuda(false);
  }

  const productosPreparados = <ul className="space-y-2">{items.map((item) => {
    const formato = (valor: number) => formatearCantidadPreparacionEntrega(valor, item.nombrePresentacion, item.unidad, item.modoCantidadSnapshot);
    return <li key={item.id} className="rounded-xl border border-border p-3">
      <p className="break-words text-sm font-semibold">{item.nombreProducto}{item.nombrePresentacion ? ` · ${item.nombrePresentacion}` : ""}</p>
      <p className="mt-1 text-xs text-muted-foreground">Preparado: {item.cantidadPreparada === null ? "Sin registrar" : formato(item.cantidadPreparada)} · Solicitado: {formato(item.cantidad)}</p>
      <p className="mt-1 text-xs text-muted-foreground">Importe provisional de preparación: {formatCLP(item.importeOperativo ?? item.importeOriginal)}{item.importeOperativo === null ? " (referencia original)" : ""}</p>
      {paso === 1 && diferencias ? <label className="mt-3 block text-sm" htmlFor={`${id}-${item.id}`}>Cantidad realmente entregada
        <input id={`${id}-${item.id}`} type="number" inputMode="decimal" min="0" step={fraccionable(item) ? "0.001" : "1"} disabled={cargando || enviado} className={campo} value={cantidades[item.id]} onChange={(event) => { setResumen(null); setBalanceServidor(null); setError(null); setCantidades((actual) => ({ ...actual, [item.id]: event.target.value })); }} aria-invalid={!cantidadValida(item)} />
        <span className="mt-1 block text-xs text-muted-foreground">{fraccionable(item) ? "Kilogramos, hasta tres decimales." : "Unidades o presentaciones completas, sin decimales."} Se permite cero y superar lo preparado.</span>
      </label> : <p className="mt-2 text-sm font-medium">Entregado: {formato(diferencias ? Number(cantidades[item.id]) : item.cantidadPreparada ?? 0)}</p>}
    </li>;
  })}</ul>;

  const productos = resumen && !(diferencias && paso === 1) ? <section className="space-y-3">
    <h3 className="text-sm font-semibold">Resumen para la entrega definitiva</h3>
    <ul className="space-y-2">{resumen.productos.map((item) => <li key={item.id} className="rounded-xl border border-border p-3 text-sm">
      <p className="font-semibold">{item.nombre}{item.presentacion ? ` · ${item.presentacion}` : ""}</p>
      {diferencias ? (() => {
        const original = items.find(i => i.id === item.id);
        const formato = (cantidad: number) => formatearCantidadPreparacionEntrega(cantidad, item.presentacion, item.unidad, original?.modoCantidadSnapshot ?? null);
        return <p>Solicitado: {formato(original?.cantidad ?? 0)} · Preparado: {formato(original?.cantidadPreparada ?? 0)} · Entregado: {formato(item.cantidad)}</p>;
      })() : <p>Preparado / a entregar: {formatearCantidadPreparacionEntrega(item.cantidad, item.presentacion, item.unidad, items.find((original) => original.id === item.id)?.modoCantidadSnapshot ?? null)}</p>}
      <p>Importe para confirmar: {formatCLP(item.importe)}</p>
    </li>)}</ul>
    <div className="space-y-1 text-sm"><p>Subtotal: {formatCLP(resumen.subtotal)}</p><p>Entrega: {formatCLP(resumen.costoEntrega)}</p><p>Descuento: {formatCLP(resumen.descuento)}</p><p className="font-semibold">Total para confirmar: {formatCLP(resumen.total)}</p></div>
    <p className="text-xs text-muted-foreground">Incluye productos con cantidad cero. Estos importes serán definitivos solo al confirmar la entrega; todavía no se ha registrado una venta.</p>
  </section> : productosPreparados;

  const balance = <div className="space-y-2 rounded-xl bg-muted/50 p-3 text-sm" role="status" aria-live="polite" aria-atomic="true">
    <p className="flex flex-wrap justify-between gap-2"><span>Total de la entrega</span><strong>{formatCLP(totalReferencia)}</strong></p>
    <p className="flex flex-wrap justify-between gap-2"><span>Total recibido</span><strong>{formatCLP(recibido)}</strong></p>
    <p className="flex flex-wrap justify-between gap-2 font-semibold"><span>{diferencias && paso !== 3 ? "Saldo tras abonos anteriores" : metodo === "pendiente" ? "Deuda prevista" : (balanceServidor && paso === 3 ? balanceServidor.saldo_a_favor_generado > 0 : saldo < 0) ? "Saldo a favor" : "Monto pendiente"}</span><span>{diferencias && !(balanceServidor && paso === 3) ? "Se calculará al continuar" : formatCLP(balanceServidor && paso === 3 ? (balanceServidor.saldo_a_favor_generado || balanceServidor.deuda_pendiente) : Math.abs(saldo))}</span></p>
    <p className="text-xs text-muted-foreground">El servidor verifica abonos anteriores y calcula la deuda o el excedente. Los valores se confirman atómicamente al guardar.</p>
  </div>;

  return <Dialog.Popup className="motion-dialog-content flex max-h-[calc(100dvh-1rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xl outline-none">
    <header className="flex shrink-0 items-start justify-between gap-3 border-b border-border p-4">
      <div className="min-w-0"><Dialog.Title className="text-lg font-semibold">Entrega del pedido {numero}</Dialog.Title><Dialog.Description className="mt-1 break-words text-sm text-muted-foreground">{cliente} · Confirmación de entrega y cobro</Dialog.Description></div>
      <Dialog.Close type="button" aria-label="Cerrar entrega" className="flex size-11 shrink-0 items-center justify-center rounded-lg hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"><X className="size-5" aria-hidden="true" /></Dialog.Close>
    </header>
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
      <ol aria-label="Pasos de entrega" className="mb-4 grid grid-cols-3 gap-2 text-xs">{["Productos", "Pago", "Resumen"].map((nombre, indice) => <li key={nombre} aria-current={paso === indice + 1 ? "step" : undefined} className={`rounded-lg px-2 py-2 text-center ${paso === indice + 1 ? "bg-primary text-primary-foreground font-semibold" : "bg-muted text-muted-foreground"}`}>{indice + 1}. {nombre}</li>)}</ol>
      <div className="space-y-4">
        {paso === 1 ? <>
          <fieldset className="space-y-2"><legend className="mb-2 font-semibold">¿Cómo fue la entrega?</legend>{([
            ["correcto", "Todo correcto", "El cliente recibió exactamente los productos y cantidades preparados."],
            ["diferencias", "Hubo diferencias", "Indica las cantidades realmente entregadas, incluyendo cero."],
          ] as const).map(([valor, titulo, texto]) => <label key={valor} className={`flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border p-3 ${resultado === valor ? "border-primary bg-primary/5" : "border-border"}`}><input type="radio" name={`${id}-resultado`} className="mt-1 size-4 accent-primary" checked={resultado === valor} disabled={cargando} onChange={() => { if (resultado !== valor) { setResumen(null); setBalanceServidor(null); } setResultado(valor); setError(null); }} /><span><span className="block text-sm font-semibold">{titulo}</span><span className="mt-1 block text-xs text-muted-foreground">{texto}</span></span></label>)}</fieldset>
          {productos}
          <p className="text-sm font-semibold">Total provisional de referencia: {formatCLP(totalReferencia)}</p>
          {diferencias ? <p className="text-xs text-muted-foreground">Al continuar, el servidor calculará el total definitivo con las reglas de precio autorizadas. Si no cambió ninguna cantidad, selecciona Todo correcto.</p> : null}
        </> : null}
        {paso === 2 ? <>
          {diferencias ? productos : null}
          <fieldset><legend className="mb-2 font-semibold">Método de pago del cliente</legend><div className="grid grid-cols-2 gap-2">{([["efectivo", "Efectivo"], ["transferencia", "Transferencia"], ["ambos", "Efectivo + Transferencia"], ["pendiente", "Por pagar"]] as const).map(([valor, titulo]) => <label key={valor} className={`flex min-h-12 cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm ${metodo === valor ? "border-primary bg-primary/5" : "border-border"}`}><input type="radio" name={`${id}-pago`} className="size-4 shrink-0 accent-primary" checked={metodo === valor} onChange={() => elegirMetodo(valor)} /><span>{titulo}</span></label>)}</div></fieldset>
          {metodo && metodo !== "pendiente" ? <><p className="text-xs text-muted-foreground">Montos en CLP, sin decimales. Puedes registrar abonos parciales o montos superiores al total. La precarga es solo una referencia.</p><div className="grid gap-3 sm:grid-cols-2">{usaEfectivo ? <label className="text-sm" htmlFor={`${id}-efectivo`}>Efectivo (CLP)<input id={`${id}-efectivo`} type="number" inputMode="numeric" min="0" step="1" className={campo} value={efectivo} onChange={(event) => setEfectivo(event.target.value)} /></label> : null}{usaTransferencia ? <label className="text-sm" htmlFor={`${id}-transferencia`}>Transferencia (CLP)<input id={`${id}-transferencia`} type="number" inputMode="numeric" min="0" step="1" className={campo} value={transferencia} onChange={(event) => setTransferencia(event.target.value)} /></label> : null}</div></> : null}
          {metodo === "pendiente" ? <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-3"><p className="text-sm">No se recibe pago. El saldo pendiente se revisará en el resumen antes de confirmar.</p><label className="mt-3 flex min-h-11 cursor-pointer items-start gap-3 text-sm"><input type="checkbox" className="mt-1 size-4 shrink-0 accent-primary" checked={confirmarDeuda} onChange={(event) => setConfirmarDeuda(event.target.checked)} /><span>Confirmo que el cliente dejaría esta entrega por pagar. La entrega quedará registrada con su saldo pendiente.</span></label></div> : null}
          {balance}
          {metodo && !pagoValido && metodo !== "pendiente" ? <p className="text-xs text-destructive">Ingresa montos enteros CLP mayores a cero en cada medio seleccionado.</p> : null}
        </> : null}
        {paso === 3 ? <><h2 className="font-semibold">Revisar entrega</h2><p className="text-sm text-muted-foreground">{diferencias ? "Hubo diferencias · cantidades valoradas por el servidor" : "Todo correcto · coincide con lo preparado"}</p>{productos}<section className="space-y-2"><h3 className="text-sm font-semibold">Método de pago del cliente</h3><p className="text-sm">{metodo === "pendiente" ? "Por pagar · confirmación adicional aceptada" : metodo === "ambos" ? "Efectivo + Transferencia" : metodo === "efectivo" ? "Efectivo" : "Transferencia"}</p>{usaEfectivo ? <p className="text-sm">Efectivo: {formatCLP(Number(efectivo))}</p> : null}{usaTransferencia ? <p className="text-sm">Transferencia: {formatCLP(Number(transferencia))}</p> : null}{balance}</section></> : null}
      </div>
    </div>
    <footer className="shrink-0 space-y-2 border-t border-border bg-card p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      {exito ? <p role="status" className="text-sm font-semibold">Entrega y cobro registrados. Deuda: {formatCLP(exito.deuda_pendiente)} · Saldo a favor generado: {formatCLP(exito.saldo_a_favor_generado)}</p> : null}
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      <div className="flex gap-2">{paso > 1 ? <Button type="button" variant="outline" disabled={cargando || enviado} onClick={() => { setBalanceServidor(null); setPaso(paso - 1); }}>Atrás</Button> : <Dialog.Close render={<Button variant="outline" />}>Cancelar</Dialog.Close>}{paso < 3 ? <Button type="button" className="min-w-0 flex-1" disabled={cargando || (paso === 1 ? !resultado || (diferencias && !cantidadesValidas) : !pagoValido)} onClick={continuar}>{cargando ? "Preparando resumen…" : "Continuar"}</Button> : <Button type="button" className="min-w-0 flex-1" disabled={!habilitada || cargando || enviando || !!exito || !resultado || !resumen || !pagoValido || !balanceServidor} onClick={confirmar} aria-describedby={`${id}-aviso`}>{enviando ? "Confirmando…" : enviado && !exito ? "Reintentar confirmación" : "Confirmar entrega"}</Button>}</div>
      <p id={`${id}-aviso`} className="text-center text-xs text-muted-foreground">La entrega y el pago se registran juntos. Tras enviar, los reintentos conservan la misma clave, versión, cantidades y cobro.</p>
    </footer>
  </Dialog.Popup>;
}
