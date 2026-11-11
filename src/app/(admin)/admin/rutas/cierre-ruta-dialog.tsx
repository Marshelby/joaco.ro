"use client";

import { Dialog } from "@base-ui/react/dialog";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { EntregaFallidaDialog } from "./entrega-fallida-dialog";
import { cerrarRuta, revisarCierreRuta, type ResumenCierre, type SolicitudCierre } from "./cierre-actions";

export function CierreRutaDialog({ fecha, cerrada }: { fecha: string; cerrada: boolean }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [resumen, setResumen] = useState<ResumenCierre | null>(null);
  const [error, setError] = useState("");
  const [confirmado, setConfirmado] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [pendiente, iniciar] = useTransition();
  const bloqueo = useRef(false);
  const intento = useRef<SolicitudCierre | null>(null);
  function revisar() {
    if (bloqueo.current) return;
    bloqueo.current = true;
    iniciar(async () => {
      try {
        const r = await revisarCierreRuta(fecha);
        if (!r.resumen) { setError(r.error ?? "No se pudo revisar la carga."); return; }
        setResumen(r.resumen); setError(""); setConfirmado(false);
        intento.current = null; setEnviado(false);
      } catch { setError("No se pudo actualizar el resumen."); }
      finally { bloqueo.current = false; }
    });
  }
  function cerrar() {
    if (bloqueo.current || !resumen || !confirmado) return;
    bloqueo.current = true;
    intento.current ??= { fecha, version: resumen.version, huella: resumen.huella, clave: crypto.randomUUID() };
    const solicitud = intento.current;
    setEnviado(true);
    iniciar(async () => {
      try {
        const r = await cerrarRuta(solicitud);
        if (!r.resumen) { setError(r.error ?? "No se pudo cerrar. Reintenta la misma solicitud."); return; }
        setResumen(r.resumen); setError(""); router.refresh();
      } catch { setError("No se recibió respuesta. Reintenta con la misma solicitud."); }
      finally { bloqueo.current = false; }
    });
  }
  const finalizada = resumen?.estado === "cerrada";
  const pendientes = resumen?.pedidos.filter(p => !["entregado", "entrega_fallida"].includes(p.estado)) ?? [];
  return <Dialog.Root open={abierto} onOpenChange={valor => {
    if (bloqueo.current) return;
    setAbierto(valor);
    if (valor && !intento.current) revisar();
  }}>
    <Dialog.Trigger className={buttonVariants({ variant: "secondary" })}>{cerrada ? "Ver cierre de ruta" : "Terminar ruta"}</Dialog.Trigger>
    <Dialog.Portal><Dialog.Backdrop className="fixed inset-0 z-40 bg-foreground/30" />
      <Dialog.Viewport className="fixed inset-0 z-40 flex items-center justify-center p-3">
        <Dialog.Popup className="max-h-[90dvh] w-full max-w-xl space-y-4 overflow-y-auto rounded-xl border bg-card p-5 shadow-xl">
          <Dialog.Title className="text-lg font-semibold">{finalizada ? "Ruta cerrada" : "Terminar ruta"}</Dialog.Title>
          <Dialog.Description className="text-sm">Resumen exclusivo de los pedidos incluidos en esta carga. El cierre conserva el resultado y bloquea nuevas entregas y cambios en la ruta.</Dialog.Description>
          {resumen ? <>
            <p className="text-sm">Entregados: {resumen.pedidos.filter(p => p.estado === "entregado").length} · No entregados: {resumen.pedidos.filter(p => p.estado === "entrega_fallida").length} · Pendientes: {pendientes.length}</p>
            <ul className="space-y-3">{resumen.pedidos.map(p => <li key={`${p.id}:${p.version}`} className="space-y-2 rounded-lg border p-3 text-sm">
              <p className="font-semibold">{p.numero} · {p.cliente}</p>
              <p>{p.estado === "entregado" ? "Entregado" : p.estado === "entrega_fallida" ? `No entregado · ${p.motivo ?? "Consultar historial"}` : `Pendiente · ${p.estado}`}</p>
              {!finalizada && !enviado && p.estado === "en_reparto" ? <EntregaFallidaDialog habilitada={!pendiente} pedidoId={p.id} versionEsperada={p.version} numero={p.numero} cliente={p.cliente} ubicacion={null} productos={0} totalReferencia={0} ocultarReferencia onRegistrada={revisar} /> : null}
            </li>)}</ul>
            {finalizada ? <p role="status" className="break-words text-sm">Cerrada el {resumen.cerrada_en} · Actor {resumen.cerrada_por}</p> : <>
              {pendientes.length > 0 ? <p className="text-sm">Registra cada pendiente como No entregado con su motivo, o completa su entrega antes de cerrar. Otros estados requieren revisión administrativa.</p> : null}
              <p className="text-sm">El cierre no genera ventas, pagos ni cargos. Los saldos previos se conservan.</p>
              <label className="flex gap-2 text-sm"><input type="checkbox" checked={confirmado} disabled={pendiente || enviado || pendientes.length > 0} onChange={e => setConfirmado(e.target.checked)} />Confirmo el resultado y deseo cerrar esta ruta.</label>
              {enviado ? <p className="text-xs">Los reintentos conservan la solicitud original. Actualizar la revisión consulta el estado persistido antes de preparar otro cierre.</p> : null}
              <div className="flex flex-wrap gap-2"><Button disabled={pendiente || !confirmado || pendientes.length > 0 || resumen.pedidos.length === 0} onClick={cerrar}>{enviado ? "Reintentar cierre" : "Confirmar cierre de ruta"}</Button><Button variant="outline" disabled={pendiente} onClick={revisar}>Actualizar revisión</Button></div>
            </>}
          </> : <Button disabled={pendiente} onClick={revisar}>Reintentar revisión</Button>}
          {pendiente ? <p role="status">Consultando o registrando operación…</p> : null}
          {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
          <Dialog.Close render={<Button variant="outline" disabled={pendiente} />}>Cerrar ventana</Dialog.Close>
        </Dialog.Popup>
      </Dialog.Viewport>
    </Dialog.Portal>
  </Dialog.Root>;
}
