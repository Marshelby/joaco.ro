"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Menu } from "@base-ui/react/menu";
import { MoreHorizontal, Repeat2, XCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";

import { cancelarPedidoCliente, prepararRepeticionPedido, type ResultadoPrepararRepeticion } from "@/app/(customer)/mi-cuenta/pedidos/actions";
import { useCart, type ModoCargaCarrito, type ResultadoCargaCarrito } from "@/components/cart/cart-provider";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/config/routes";
import type { EstadoPedidoCuenta } from "@/lib/account/pedidos";

type RepeticionPendiente = Extract<ResultadoPrepararRepeticion, { estado: "ok" }>;

const etiquetasOmitidas = {
  producto_no_disponible: "Producto no disponible",
  presentacion_no_disponible: "Presentación no disponible",
  cantidad_invalida: "La cantidad original ya no es válida",
} as const;

function construirFeedback(resultado: ResultadoCargaCarrito, repeticion: RepeticionPendiente) {
  const cargadas = resultado.agregadas + resultado.fusionadas;
  const omitidas = repeticion.lineasOmitidas.length + resultado.omitidas;
  const motivos: string[] = [...new Set(repeticion.lineasOmitidas.map((linea) => etiquetasOmitidas[linea.motivo]))];
  if (resultado.omitidas > 0) motivos.push("Una cantidad supera los límites actuales del carrito");

  return {
    mensaje: cargadas === 1 ? "Se agregó 1 producto al carrito con su precio actual." : `Se agregaron ${cargadas} productos al carrito con sus precios actuales.`,
    detalle: omitidas > 0 ? `${omitidas} ${omitidas === 1 ? "producto no pudo agregarse" : "productos no pudieron agregarse"}${motivos.length > 0 ? `: ${motivos.join(". ")}.` : "."}` : null,
  };
}

export function OrderRepeatAction({ pedidoId, numeroPedido, estado }: { pedidoId: string; numeroPedido: string; estado: EstadoPedidoCuenta }) {
  const router = useRouter();
  const { numeroItems, cargarLineas, isHydrated } = useCart();
  const [resolviendo, setResolviendo] = useState(false);
  const [dialogoAbierto, setDialogoAbierto] = useState(false);
  const [dialogoCancelacionAbierto, setDialogoCancelacionAbierto] = useState(false);
  const [pendiente, setPendiente] = useState<RepeticionPendiente | null>(null);
  const [feedback, setFeedback] = useState<{ mensaje: string; detalle: string | null } | null>(null);
  const [resultadoCancelacion, cancelar, cancelando] = useActionState(cancelarPedidoCliente, {});

  useEffect(() => {
    if (resultadoCancelacion.refrescar) {
      router.refresh();
      return;
    }
    if (!resultadoCancelacion.cancelado) return;
    setDialogoCancelacionAbierto(false);
    router.refresh();
  }, [resultadoCancelacion.cancelado, resultadoCancelacion.refrescar, router]);

  const aplicarRepeticion = (repeticion: RepeticionPendiente, modo: ModoCargaCarrito) => {
    const resultado = cargarLineas(repeticion.lineasValidas, modo);
    setFeedback(construirFeedback(resultado, repeticion));
    setDialogoAbierto(false);
    setPendiente(null);
  };

  const iniciarRepeticion = async () => {
    if (resolviendo || !isHydrated) return;
    setResolviendo(true);
    setFeedback(null);

    const resultado = await prepararRepeticionPedido(pedidoId);
    setResolviendo(false);

    if (resultado.estado === "pedido_no_encontrado" || resultado.estado === "no_autorizado") {
      setFeedback({ mensaje: "No fue posible preparar este pedido para repetir.", detalle: null });
      return;
    }
    if (resultado.estado === "error") {
      setFeedback({ mensaje: "No fue posible preparar el pedido. Inténtalo nuevamente.", detalle: null });
      return;
    }
    if (resultado.lineasValidas.length === 0) {
      const motivos = [...new Set(resultado.lineasOmitidas.map((linea) => etiquetasOmitidas[linea.motivo]))];
      setFeedback({ mensaje: "Los productos de este pedido ya no están disponibles para volver a agregarlos.", detalle: motivos.length > 0 ? motivos.join(". ") : null });
      return;
    }

    if (numeroItems === 0) {
      aplicarRepeticion(resultado, "reemplazar");
      return;
    }

    setPendiente(resultado);
    setDialogoAbierto(true);
  };

  return (
    <div className="relative shrink-0">
      <Menu.Root modal={false}>
        <Menu.Trigger className="inline-flex size-11 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50" aria-label={`Opciones del pedido ${numeroPedido}`}>
          <MoreHorizontal className="size-5" aria-hidden="true" />
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner side="bottom" align="end" sideOffset={8} className="z-50">
            <Menu.Popup className="min-w-48 rounded-lg border border-border bg-card p-1 shadow-lg outline-none">
              <Menu.Item onClick={iniciarRepeticion} disabled={resolviendo || !isHydrated} className="flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-md px-3 text-sm font-medium text-foreground outline-none data-[highlighted]:bg-muted data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50">
                <Repeat2 className="size-4" aria-hidden="true" />
                {resolviendo ? "Preparando…" : isHydrated ? "Repetir pedido" : "Cargando carrito…"}
              </Menu.Item>
              {estado === "recibido" ? <>
                <div className="my-1 border-t border-border" />
                <Menu.Item onClick={() => { setFeedback(null); setDialogoCancelacionAbierto(true); }} className="flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-md px-3 text-sm font-medium text-destructive outline-none data-[highlighted]:bg-destructive/10">
                  <XCircle className="size-4" aria-hidden="true" />
                  Cancelar pedido
                </Menu.Item>
              </> : null}
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>

      <Dialog.Root open={dialogoAbierto} onOpenChange={setDialogoAbierto}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-50 bg-foreground/25" />
          <Dialog.Viewport className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
            <Dialog.Popup className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-xl outline-none sm:p-6">
              <Dialog.Title className="text-lg font-semibold tracking-tight text-foreground">Ya tienes productos en tu carrito</Dialog.Title>
              <Dialog.Description className="mt-2 text-sm leading-6 text-muted-foreground">¿Quieres sumar este pedido a tu carrito actual o empezar un carrito nuevo con este pedido?</Dialog.Description>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <Button type="button" variant="outline" className="w-full" onClick={() => pendiente && aplicarRepeticion(pendiente, "fusionar")}>Sumar al carrito actual</Button>
                <Button type="button" className="w-full" onClick={() => pendiente && aplicarRepeticion(pendiente, "reemplazar")}>Empezar carrito nuevo</Button>
              </div>
              <Dialog.Close className="mt-3 min-h-11 w-full rounded-lg text-sm font-medium text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50">Cancelar</Dialog.Close>
            </Dialog.Popup>
          </Dialog.Viewport>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root open={dialogoCancelacionAbierto} onOpenChange={setDialogoCancelacionAbierto}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-50 bg-foreground/25" />
          <Dialog.Viewport className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
            <Dialog.Popup className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-xl outline-none sm:p-6">
              <Dialog.Title className="text-lg font-semibold tracking-tight text-foreground">¿Cancelar este pedido?</Dialog.Title>
              <Dialog.Description className="mt-2 text-sm leading-6 text-muted-foreground">Puedes cancelar el pedido {numeroPedido} mientras Hidro Leufú aún no lo haya confirmado.</Dialog.Description>
              <p className="mt-2 text-sm text-muted-foreground">Una vez confirmado por nuestro equipo, ya no podrás cancelarlo desde tu cuenta.</p>
              <form action={cancelar} className="mt-5 space-y-4">
                <input type="hidden" name="pedidoId" value={pedidoId} />
                <label className="block text-sm font-medium text-foreground" htmlFor={`motivo-cancelacion-${pedidoId}`}>
                  Motivo <span className="font-normal text-muted-foreground">(opcional)</span>
                </label>
                <textarea id={`motivo-cancelacion-${pedidoId}`} name="motivo" maxLength={400} placeholder="Ej. Me equivoqué en las cantidades" className="mt-2 min-h-24 w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50" disabled={cancelando} />
                {resultadoCancelacion.error ? <p aria-live="polite" className="text-sm text-destructive">{resultadoCancelacion.error}</p> : null}
                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                  <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => setDialogoCancelacionAbierto(false)} disabled={cancelando}>Volver</Button>
                  <Button type="submit" variant="destructive" className="w-full sm:w-auto" disabled={cancelando}>{cancelando ? "Cancelando…" : "Cancelar pedido"}</Button>
                </div>
              </form>
            </Dialog.Popup>
          </Dialog.Viewport>
        </Dialog.Portal>
      </Dialog.Root>

      {feedback ? <div className="absolute right-0 top-full z-10 mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-lg bg-muted px-3 py-2 text-sm shadow-md" aria-live="polite"><p className="font-medium text-foreground">{feedback.mensaje}</p>{feedback.detalle ? <p className="mt-1 leading-5 text-muted-foreground">{feedback.detalle}</p> : null}<Link href={ROUTES.cart} className="mt-2 inline-flex min-h-9 items-center text-sm font-semibold text-primary outline-none hover:text-primary/75 focus-visible:ring-3 focus-visible:ring-ring/50">Ver carrito</Link></div> : null}
    </div>
  );
}
