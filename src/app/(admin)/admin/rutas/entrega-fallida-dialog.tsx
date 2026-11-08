"use client";

import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { formatCLP } from "@/lib/formatters";
import { registrarEntregaFallida, type SolicitudEntregaFallida } from "./fallida-actions";

const motivos = ["Cliente ausente", "Cliente rechazó pedido", "Dirección incorrecta", "Problema de acceso", "Otro"];
const campo = "mt-1 min-h-11 w-full rounded-lg border border-input bg-background p-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function EntregaFallidaDialog({ habilitada, pedidoId, versionEsperada, numero, cliente, ubicacion, productos, totalReferencia }: {
  habilitada: boolean; pedidoId: string; versionEsperada: number; numero: string; cliente: string;
  ubicacion: string | null; productos: number; totalReferencia: number;
}) {
  const id = useId();
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [confirmado, setConfirmado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [pendiente, startTransition] = useTransition();
  const bloqueo = useRef(false);
  // Permanece al cerrar/reabrir el modal; tras enviar se congela TODO el payload.
  const intento = useRef<SolicitudEntregaFallida | null>(null);
  const texto = [motivo === "Otro" ? descripcion.trim() : "", observaciones.trim()].filter(Boolean).join("\n\n");
  const valido = motivos.includes(motivo) && (motivo !== "Otro" || !!descripcion.trim()) && texto.length <= 2000 && confirmado;
  function confirmar() {
    if (bloqueo.current || pendiente || exito || !habilitada || !valido) return;
    bloqueo.current = true;
    setError(null);
    startTransition(async () => {
      try {
        intento.current ??= { p_pedido_id: pedidoId, p_version_esperada: versionEsperada,
          p_clave: crypto.randomUUID(), p_motivo: motivo, p_observaciones: texto || null };
        setEnviado(true);
        const respuesta = await registrarEntregaFallida(intento.current, true);
        if (!respuesta.exito) { setError(respuesta.error ?? "No se pudo registrar. Reintenta con la misma solicitud."); return; }
        setExito(true);
        router.refresh();
      } catch { setError("No se pudo verificar la respuesta. Reintenta con la misma solicitud para evitar duplicados."); }
      finally { bloqueo.current = false; }
    });
  }
  return <Dialog.Root open={abierto} onOpenChange={(valor) => { if (!bloqueo.current) setAbierto(valor); }}>
    <Dialog.Trigger disabled={!habilitada || exito} className={buttonVariants({ variant: "outline" })}>No entregado</Dialog.Trigger>
    <Dialog.Portal keepMounted>
      <Dialog.Backdrop className="motion-dialog-backdrop fixed inset-0 z-50 bg-foreground/30" />
      <Dialog.Viewport className="fixed inset-0 z-50 flex items-end justify-center p-2 sm:items-center sm:p-4">
        <Dialog.Popup className="motion-dialog-content flex max-h-[calc(100dvh-1rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xl outline-none">
          <header className="flex shrink-0 items-start justify-between gap-3 border-b border-border p-4">
            <div><Dialog.Title className="text-lg font-semibold">Registrar entrega fallida</Dialog.Title><Dialog.Description className="mt-1 text-sm text-muted-foreground">Deja constancia del intento de entrega y su motivo.</Dialog.Description></div>
            <Dialog.Close disabled={pendiente} aria-label="Cerrar" className="flex size-11 shrink-0 items-center justify-center rounded-lg hover:bg-muted"><X className="size-5" /></Dialog.Close>
          </header>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4">
            <section aria-label="Resumen del pedido" className="space-y-1 rounded-xl bg-muted/50 p-3 text-sm">
              <p className="font-semibold">Pedido {numero} · {cliente}</p>
              <p>{ubicacion || "Sin ubicación comercial registrada"}</p>
              <p>{productos} productos · Referencia provisional: {formatCLP(totalReferencia)}</p>
            </section>
            <p className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-3 text-sm">Confirmar una entrega fallida no genera venta definitiva, deuda nueva ni pagos. Los registros previos se conservan. El pedido quedará en entrega fallida.</p>
            <fieldset disabled={enviado || pendiente || exito || !habilitada} className="space-y-3">
              <label className="block text-sm font-medium" htmlFor={`${id}-motivo`}>Motivo obligatorio<select id={`${id}-motivo`} required className={campo} value={motivo} onChange={(e) => setMotivo(e.target.value)}><option value="">Selecciona un motivo</option>{motivos.map(m => <option key={m}>{m}</option>)}</select></label>
              {motivo === "Otro" ? <label className="block text-sm font-medium" htmlFor={`${id}-descripcion`}>Descripción obligatoria<textarea id={`${id}-descripcion`} required maxLength={2000} rows={2} className={campo} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} /></label> : null}
              <label className="block text-sm font-medium" htmlFor={`${id}-observaciones`}>Observaciones adicionales (opcional)<textarea id={`${id}-observaciones`} maxLength={2000} rows={2} className={campo} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} /></label>
              <p className={`text-xs ${texto.length > 2000 ? "text-destructive" : "text-muted-foreground"}`}>{texto.length} / 2000 caracteres en total.</p>
              <label className="flex min-h-11 items-start gap-3 text-sm"><input type="checkbox" className="mt-1 size-4 shrink-0 accent-primary" checked={confirmado} onChange={(e) => setConfirmado(e.target.checked)} /><span>Confirmo que este pedido no fue entregado y deseo registrar el motivo indicado.</span></label>
            </fieldset>
            {enviado && !exito ? <p className="text-xs text-muted-foreground">La solicitud enviada queda fija. Los reintentos conservan la clave, versión, motivo y observaciones originales.</p> : null}
          </div>
          <footer className="shrink-0 space-y-3 border-t border-border p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
            {exito ? <p role="status" className="text-sm font-semibold">Entrega fallida registrada. No se generaron venta definitiva, deuda nueva ni pagos.</p> : null}
            {!habilitada && !exito ? <p role="status" className="text-sm">El pedido ya no está en reparto. No se puede confirmar otra entrega.</p> : null}
            <div className="flex gap-2"><Dialog.Close render={<Button variant="outline" disabled={pendiente} />}>{exito ? "Cerrar" : "Cancelar"}</Dialog.Close>{!exito ? <Button className="min-w-0 flex-1" disabled={!valido || pendiente || !habilitada} onClick={confirmar}>{pendiente ? "Registrando…" : enviado ? "Reintentar registro" : "Confirmar entrega fallida"}</Button> : null}</div>
          </footer>
        </Dialog.Popup>
      </Dialog.Viewport>
    </Dialog.Portal>
  </Dialog.Root>;
}
