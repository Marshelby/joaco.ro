"use server";

import { revalidatePath } from "next/cache";

import { crearClienteSupabaseServidor } from "@/lib/supabase/server";

export type EstadoAjusteCuenta = { error?: string; exito?: string };
export type EstadoPagoCliente = { error?: string; exito?: string };
export type EstadoAnulacionPago = { error?: string; exito?: string };

const mensajesRpc: Record<string, string> = {
  NO_AUTORIZADO: "No tienes permisos para registrar ajustes.",
  CLIENTE_NO_ENCONTRADO: "El cliente ya no está disponible.",
  TIPO_AJUSTE_INVALIDO: "Selecciona un tipo de ajuste válido.",
  MONTO_INVALIDO: "Ingresa un monto mayor que cero.",
  MOTIVO_REQUERIDO: "Indica el motivo del ajuste.",
  CLIENTE_INVALIDO: "El cliente no existe o no está activo.",
  CLAVE_IDEMPOTENCIA_REQUERIDA: "No fue posible preparar el registro del pago. Inténtalo nuevamente.",
  CLAVE_IDEMPOTENCIA_EN_USO: "Esta confirmación ya fue utilizada para otro cliente.",
  METODO_PAGO_INVALIDO: "Selecciona un medio de pago válido.",
  PAGO_NO_ENCONTRADO: "El pago ya no existe.",
  ESTADO_PAGO_INVALIDO: "Este pago no puede anularse desde su estado actual.",
};

function texto(datos: FormData, campo: string) {
  return String(datos.get(campo) ?? "").trim();
}

export async function registrarAjusteCuentaCliente(_: EstadoAjusteCuenta, datos: FormData): Promise<EstadoAjusteCuenta> {
  const clienteId = texto(datos, "clienteId");
  const montoTexto = texto(datos, "monto");
  const monto = Number(montoTexto);
  if (!clienteId) return { error: "No fue posible identificar al cliente." };
  if (!Number.isSafeInteger(monto)) return { error: "Ingresa un monto válido, sin decimales." };

  const supabase = await crearClienteSupabaseServidor();
  const { data: sesion } = await supabase.auth.getUser();
  if (!sesion.user) return { error: mensajesRpc.NO_AUTORIZADO };

  const { error } = await supabase.rpc("registrar_ajuste_cuenta_cliente", {
    p_cliente_id: clienteId,
    p_tipo: texto(datos, "tipo"),
    p_monto: monto,
    p_motivo: texto(datos, "motivo"),
    p_observacion: texto(datos, "observacion") || null,
  });
  if (error) return { error: mensajesRpc[error.message] ?? "No fue posible registrar el ajuste." };

  revalidatePath("/admin");
  revalidatePath("/admin/clientes");
  revalidatePath(`/admin/clientes/${clienteId}`);
  return { exito: "Ajuste registrado." };
}

export async function registrarPagoCliente(_: EstadoPagoCliente, datos: FormData): Promise<EstadoPagoCliente> {
  const clienteId = texto(datos, "clienteId");
  const monto = Number(texto(datos, "monto"));
  if (!clienteId) return { error: "No fue posible identificar al cliente." };
  if (!Number.isSafeInteger(monto) || monto <= 0) return { error: "Ingresa un monto válido, sin decimales y mayor que cero." };

  const supabase = await crearClienteSupabaseServidor();
  const { data: sesion } = await supabase.auth.getUser();
  if (!sesion.user) return { error: mensajesRpc.NO_AUTORIZADO };

  const { error } = await supabase.rpc("registrar_pago_cliente_administrativo", {
    p_cliente_id: clienteId,
    p_monto: monto,
    p_metodo_pago: texto(datos, "metodoPago"),
    p_referencia: texto(datos, "referencia") || null,
    p_observacion: texto(datos, "observacion") || null,
    p_clave_idempotencia: texto(datos, "claveIdempotencia") || null,
  });
  if (error) return { error: mensajesRpc[error.message] ?? "No fue posible registrar el pago." };

  revalidatePath("/admin");
  revalidatePath("/admin/clientes");
  revalidatePath(`/admin/clientes/${clienteId}`);
  revalidatePath("/admin/pedidos");
  return { exito: "Pago registrado correctamente." };
}

export async function anularPagoCliente(_: EstadoAnulacionPago, datos: FormData): Promise<EstadoAnulacionPago> {
  const clienteId = texto(datos, "clienteId");
  const pagoId = texto(datos, "pagoId");
  if (!clienteId || !pagoId) return { error: "No fue posible identificar el pago." };

  const supabase = await crearClienteSupabaseServidor();
  const { data: sesion } = await supabase.auth.getUser();
  if (!sesion.user) return { error: mensajesRpc.NO_AUTORIZADO };
  const { error } = await supabase.rpc("anular_pago_administrativo", { p_pago_id: pagoId, p_motivo: texto(datos, "motivo") });
  if (error) return { error: mensajesRpc[error.message] ?? "No fue posible anular el pago." };

  revalidatePath("/admin");
  revalidatePath("/admin/clientes");
  revalidatePath(`/admin/clientes/${clienteId}`);
  revalidatePath("/admin/pedidos");
  return { exito: "Pago anulado. Sus aplicaciones fueron liberadas." };
}
