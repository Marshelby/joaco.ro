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
import type { PreparacionEstado } from "@/lib/order-preparation";

type EstadoOperativo = Extract<EstadoPedidoAdmin, "confirmado" | "preparando" | "listo_despacho" | "en_reparto">;

type AccionOperativa = (
  estado: EstadoTransicionPedido,
  datos: FormData,
) => Promise<EstadoTransicionPedido>;

type ContextoAccionOperativa = "general" | "preparacion";

const acciones: Record<EstadoOperativo, { accion: AccionOperativa; etiqueta: string; pendiente: string; exito: string }> = {
  confirmado: { accion: marcarPedidoPreparando, etiqueta: "Comenzar preparación", pendiente: "Preparando…", exito: "Pedido en preparación." },
  preparando: { accion: marcarPedidoListoDespacho, etiqueta: "Marcar listo para despacho", pendiente: "Actualizando…", exito: "Pedido listo para despacho." },
  listo_despacho: { accion: marcarPedidoEnReparto, etiqueta: "Marcar en reparto", pendiente: "Actualizando…", exito: "Pedido en reparto." },
  en_reparto: { accion: marcarPedidoEntregado, etiqueta: "Marcar entregado", pendiente: "Marcando…", exito: "Pedido entregado." },
};

const accionInactiva: AccionOperativa = async (estado, datos) => {
  void estado;
  void datos;
  return {};
};

export function OrderOperationalAction({
  pedidoId,
  estado,
  contexto = "general",
  preparacionEstado = null,
}: {
  pedidoId: string;
  estado: EstadoPedidoAdmin;
  contexto?: ContextoAccionOperativa;
  preparacionEstado?: PreparacionEstado | null;
}) {
  const router = useRouter();
  const esAccionDePreparacion = estado === "confirmado" || (estado === "preparando" && contexto !== "preparacion" && preparacionEstado !== "pendiente");
  const configuracion = estado in acciones && (contexto === "general" || esAccionDePreparacion)
    ? acciones[estado as EstadoOperativo]
    : null;
  const [resultado, accion, pendiente] = useActionState(
    configuracion?.accion ?? accionInactiva,
    {},
  );

  useEffect(() => {
    if (!configuracion || (!resultado.actualizado && !resultado.error)) return;
    router.refresh();
  }, [configuracion, resultado.actualizado, resultado.error, router]);

  if (!configuracion) return null;

  return (
    <form action={accion} className="space-y-2">
      <input type="hidden" name="pedidoId" value={pedidoId} />
      <Button type="submit" className="w-full sm:w-auto" disabled={pendiente}>{pendiente ? configuracion.pendiente : contexto === "preparacion" && estado === "preparando" ? "Marcar listo" : configuracion.etiqueta}</Button>
      <p aria-live="polite" className={resultado.error ? "text-sm text-destructive" : "text-sm text-primary"}>{resultado.error ?? (resultado.actualizado ? configuracion.exito : "")}</p>
    </form>
  );
}
