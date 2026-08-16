"use server";

import { revalidatePath } from "next/cache";

import { obtenerIdentidadActual } from "@/lib/account/identity";
import { obtenerLineasRepetiblesPedido } from "@/lib/account/pedidos";
import type { LineasRepetiblesPedido } from "@/lib/account/pedidos";
import { crearClienteSupabaseServidor } from "@/lib/supabase/server";

export type ResultadoPrepararRepeticion =
  | { estado: "ok"; lineasValidas: LineasRepetiblesPedido["lineasValidas"]; lineasOmitidas: LineasRepetiblesPedido["lineasOmitidas"] }
  | { estado: "no_autorizado" }
  | { estado: "pedido_no_encontrado" }
  | { estado: "error" };

export type EstadoCancelacionPedidoCliente = {
  error?: string;
  cancelado?: boolean;
  refrescar?: boolean;
};

const mensajesCancelacion: Record<string, string> = {
  NO_AUTORIZADO: "No tienes permiso para cancelar este pedido.",
  PEDIDO_NO_ENCONTRADO: "No encontramos el pedido.",
  ESTADO_PEDIDO_INVALIDO: "Este pedido ya fue confirmado y no puede cancelarse desde tu cuenta.",
  MOTIVO_DEMASIADO_LARGO: "El motivo puede tener hasta 400 caracteres.",
};

export async function prepararRepeticionPedido(pedidoId: string): Promise<ResultadoPrepararRepeticion> {
  const identidad = await obtenerIdentidadActual();
  if (!identidad || identidad.rol !== "cliente") return { estado: "no_autorizado" };

  try {
    const resultado = await obtenerLineasRepetiblesPedido(pedidoId);
    if (!resultado) return { estado: "pedido_no_encontrado" };
    return { estado: "ok", ...resultado };
  } catch {
    return { estado: "error" };
  }
}

export async function cancelarPedidoCliente(
  _: EstadoCancelacionPedidoCliente,
  datos: FormData,
): Promise<EstadoCancelacionPedidoCliente> {
  const pedidoId = String(datos.get("pedidoId") ?? "").trim();
  const motivo = String(datos.get("motivo") ?? "").trim();
  if (!pedidoId) return { error: "No fue posible identificar el pedido." };
  if (motivo.length > 400) return { error: mensajesCancelacion.MOTIVO_DEMASIADO_LARGO };

  const identidad = await obtenerIdentidadActual();
  if (!identidad || identidad.rol !== "cliente") return { error: mensajesCancelacion.NO_AUTORIZADO };

  const supabase = await crearClienteSupabaseServidor();
  const { data, error } = await supabase.rpc("cancelar_pedido_cliente", {
    p_pedido_id: pedidoId,
    p_motivo: motivo || null,
  });
  if (error) {
    return {
      error: mensajesCancelacion[error.message] ?? "No fue posible cancelar el pedido. Inténtalo nuevamente.",
      refrescar: error.message === "ESTADO_PEDIDO_INVALIDO",
    };
  }

  const resultado = (data as Array<{ pedido_id: string; cliente_id: string | null; fecha_entrega: string | null }> | null)?.[0];
  if (!resultado) return { error: "No fue posible confirmar la cancelación." };

  revalidatePath("/mi-cuenta/pedidos");
  revalidatePath(`/mi-cuenta/pedidos/${resultado.pedido_id}`);
  revalidatePath(`/pedido/confirmacion/${resultado.pedido_id}`);
  revalidatePath("/admin");
  revalidatePath("/admin/pedidos");
  revalidatePath(`/admin/pedidos/${resultado.pedido_id}`);
  revalidatePath("/admin/clientes");
  if (resultado.cliente_id) revalidatePath(`/admin/clientes/${resultado.cliente_id}`);
  if (resultado.fecha_entrega) revalidatePath(`/admin/pedidos/entregas/${resultado.fecha_entrega}`);

  return { cancelado: true };
}
