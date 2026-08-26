"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { crearClienteSupabaseServidor } from "@/lib/supabase/server";
import { obtenerClienteAdmin, type MovimientoCuentaCliente, type PedidoClienteAdmin } from "@/lib/admin/clientes";

export type EstadoAjusteCuenta = { error?: string; exito?: string };
export type EstadoPagoCliente = { error?: string; exito?: string };
export type EstadoAnulacionPago = { error?: string; exito?: string };
export type EstadoInvitacionAcceso = { error?: string; exito?: string; enlace?: string; fechaExpiracion?: string };
export type VistaRapidaClienteAdmin = {
  id: string;
  nombre: string;
  email: string | null;
  telefono: string | null;
  activo: boolean;
  usuarioId: string | null;
  saldoActual: number;
  totalPedidos: number;
  totalPagosConfirmados: number;
  movimientos: readonly MovimientoCuentaCliente[];
  pedidos: readonly PedidoClienteAdmin[];
};
export type ResultadoVistaRapidaClienteAdmin =
  | { estado: "listo"; cliente: VistaRapidaClienteAdmin }
  | { estado: "no_encontrado" }
  | { estado: "error" };

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
  CORREO_INVALIDO: "Ingresa un correo válido para la persona autorizada.",
  CLIENTE_YA_VINCULADO: "Este cliente ya tiene acceso web activo.",
  CLIENTE_INACTIVO: "No se puede habilitar acceso web para un cliente inactivo.",
  INVITACION_NO_ENCONTRADA: "La invitación ya no está disponible.",
  INVITACION_NO_DISPONIBLE: "Esta invitación ya no se puede revocar.",
};

function texto(datos: FormData, campo: string) {
  return String(datos.get(campo) ?? "").trim();
}

async function obtenerOrigenAplicacion() {
  const encabezados = await headers();
  const origin = encabezados.get("origin");
  if (origin) {
    const url = new URL(origin);
    if (url.protocol === "https:" || url.protocol === "http:") return url.origin;
  }
  const host = encabezados.get("x-forwarded-host") ?? encabezados.get("host");
  if (!host || host.includes("/")) throw new Error("No fue posible determinar el origen de la aplicación.");
  return `${encabezados.get("x-forwarded-proto") === "https" ? "https" : "http"}://${host}`;
}

function revalidarAccesoCliente(clienteId: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/clientes");
  revalidatePath(`/admin/clientes/${clienteId}`);
}

export async function obtenerVistaRapidaClienteAdmin(clienteId: string): Promise<ResultadoVistaRapidaClienteAdmin> {
  if (!clienteId) return { estado: "no_encontrado" };

  try {
    const supabase = await crearClienteSupabaseServidor();
    const { data: sesion, error: errorSesion } = await supabase.auth.getUser();
    if (errorSesion || !sesion.user) return { estado: "error" };

    const { data: perfil, error: errorPerfil } = await supabase
      .from("perfiles")
      .select("rol")
      .eq("usuario_id", sesion.user.id)
      .maybeSingle();
    if (errorPerfil || perfil?.rol !== "admin") return { estado: "error" };

    const cliente = await obtenerClienteAdmin(clienteId);
    if (!cliente) return { estado: "no_encontrado" };

    return {
      estado: "listo",
      cliente: {
        id: cliente.id,
        nombre: cliente.nombre,
        email: cliente.email,
        telefono: cliente.telefono,
        activo: cliente.activo,
        usuarioId: cliente.usuarioId,
        saldoActual: cliente.saldoActual,
        totalPedidos: cliente.totalPedidos,
        totalPagosConfirmados: cliente.totalPagosConfirmados,
        movimientos: cliente.movimientos.slice(0, 3),
        pedidos: cliente.pedidos.slice(0, 3),
      },
    };
  } catch {
    return { estado: "error" };
  }
}

export async function crearInvitacionAccesoCliente(_: EstadoInvitacionAcceso, datos: FormData): Promise<EstadoInvitacionAcceso> {
  const clienteId = texto(datos, "clienteId");
  const correoDestino = texto(datos, "correoDestino").toLowerCase();
  if (!clienteId) return { error: "No fue posible identificar al cliente." };

  const supabase = await crearClienteSupabaseServidor();
  const { data: sesion } = await supabase.auth.getUser();
  if (!sesion.user) return { error: mensajesRpc.NO_AUTORIZADO };
  const { data, error } = await supabase.rpc("crear_invitacion_acceso_cliente_administrativa", {
    p_cliente_id: clienteId,
    p_correo_destino: correoDestino,
  });
  if (error) return { error: mensajesRpc[error.message] ?? "No fue posible generar la invitación." };

  const invitacion = Array.isArray(data) ? data[0] : data;
  if (!invitacion?.token || !invitacion?.fecha_expiracion) return { error: "No fue posible preparar el enlace de invitación." };

  try {
    const origen = await obtenerOrigenAplicacion();
    const enlace = new URL("/aceptar-invitacion", origen);
    enlace.searchParams.set("token", invitacion.token);
    revalidarAccesoCliente(clienteId);
    return { exito: "Invitación creada. Copia el enlace ahora: no volverá a mostrarse.", enlace: enlace.toString(), fechaExpiracion: invitacion.fecha_expiracion };
  } catch {
    return { error: "La invitación fue creada, pero no pudimos preparar el enlace. Revócala y genera una nueva." };
  }
}

export async function revocarInvitacionAccesoCliente(_: EstadoInvitacionAcceso, datos: FormData): Promise<EstadoInvitacionAcceso> {
  const clienteId = texto(datos, "clienteId");
  const invitacionId = texto(datos, "invitacionId");
  if (!clienteId || !invitacionId) return { error: "No fue posible identificar la invitación." };

  const supabase = await crearClienteSupabaseServidor();
  const { data: sesion } = await supabase.auth.getUser();
  if (!sesion.user) return { error: mensajesRpc.NO_AUTORIZADO };
  const { error } = await supabase.rpc("revocar_invitacion_acceso_cliente_administrativa", { p_invitacion_id: invitacionId });
  if (error) return { error: mensajesRpc[error.message] ?? "No fue posible revocar la invitación." };

  revalidarAccesoCliente(clienteId);
  return { exito: "Invitación revocada." };
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
