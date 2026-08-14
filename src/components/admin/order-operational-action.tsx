"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";

import {
  marcarPedidoEnReparto,
  marcarPedidoEntregado,
  marcarPedidoListoDespacho,
  marcarPedidoPreparando,
  type EstadoTransicionPedido,
} from "@/app/(admin)/admin/pedidos/actions";
import { Button } from "@/components/ui/button";
import type { EstadoPedidoAdmin } from "@/lib/admin/pedidos";

type EstadoOperativo = Extract<EstadoPedidoAdmin, "confirmado" | "preparando" | "listo_despacho" | "en_reparto">;

const acciones: Record<EstadoOperativo, { accion: (estado: EstadoTransicionPedido, datos: FormData) => Promise<EstadoTransicionPedido>; etiqueta: string; pendiente: string; exito: string }> = {
  confirmado: { accion: marcarPedidoPreparando, etiqueta: "Comenzar preparación", pendiente: "Preparando…", exito: "Pedido en preparación." },
  preparando: { accion: marcarPedidoListoDespacho, etiqueta: "Marcar listo para despacho", pendiente: "Actualizando…", exito: "Pedido listo para despacho." },
  listo_despacho: { accion: marcarPedidoEnReparto, etiqueta: "Marcar en reparto", pendiente: "Actualizando…", exito: "Pedido en reparto." },
  en_reparto: { accion: marcarPedidoEntregado, etiqueta: "Marcar entregado", pendiente: "Marcando…", exito: "Pedido entregado." },
};

export function OrderOperationalAction({ pedidoId, estado }: { pedidoId: string; estado: EstadoPedidoAdmin }) {
  const router = useRouter();
  const configuracion = estado in acciones ? acciones[estado as EstadoOperativo] : null;
  if (!configuracion) return null;
  const [resultado, accion, pendiente] = useActionState(configuracion.accion, {});

  useEffect(() => {
    if (resultado.actualizado) router.refresh();
  }, [resultado.actualizado, router]);

  return (
    <form action={accion} className="space-y-2">
      <input type="hidden" name="pedidoId" value={pedidoId} />
      <Button type="submit" className="w-full sm:w-auto" disabled={pendiente}>{pendiente ? configuracion.pendiente : configuracion.etiqueta}</Button>
      <p aria-live="polite" className={resultado.error ? "text-sm text-destructive" : "text-sm text-primary"}>{resultado.error ?? (resultado.actualizado ? configuracion.exito : "")}</p>
    </form>
  );
}
