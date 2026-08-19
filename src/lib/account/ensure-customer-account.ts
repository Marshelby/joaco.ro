import "server-only";

import { crearClienteSupabaseServidor } from "@/lib/supabase/server";

export type CuentaClienteAsegurada = {
  usuarioId: string;
  rol: "cliente" | "admin";
  clienteId: string | null;
  clienteActivo: boolean | null;
  clienteCreado: boolean;
  perfilReparado: boolean;
};

type CuentaClienteAseguradaFila = {
  usuario_id: string;
  rol: CuentaClienteAsegurada["rol"];
  cliente_id: string | null;
  cliente_activo: boolean | null;
  cliente_creado: boolean;
  perfil_reparado: boolean;
};

type EjecutarEnsureCuentaCliente = () => PromiseLike<{ data: unknown; error: unknown }>;

function esFilaCuentaClienteAsegurada(valor: unknown): valor is CuentaClienteAseguradaFila {
  if (!valor || typeof valor !== "object") return false;
  const fila = valor as Record<string, unknown>;
  return typeof fila.usuario_id === "string"
    && (fila.rol === "cliente" || fila.rol === "admin")
    && (typeof fila.cliente_id === "string" || fila.cliente_id === null)
    && (typeof fila.cliente_activo === "boolean" || fila.cliente_activo === null)
    && typeof fila.cliente_creado === "boolean"
    && typeof fila.perfil_reparado === "boolean";
}

export async function ensureCustomerAccountWithRpc(ejecutar: EjecutarEnsureCuentaCliente): Promise<CuentaClienteAsegurada> {
  const { data, error } = await ejecutar();
  if (error) throw error;

  const fila = Array.isArray(data) ? data[0] : data;
  if (!esFilaCuentaClienteAsegurada(fila)) throw new Error("La cuenta actual no pudo asegurarse.");

  return {
    usuarioId: fila.usuario_id,
    rol: fila.rol,
    clienteId: fila.cliente_id,
    clienteActivo: fila.cliente_activo,
    clienteCreado: fila.cliente_creado,
    perfilReparado: fila.perfil_reparado,
  };
}

export async function ensureCurrentCustomerAccount(): Promise<CuentaClienteAsegurada> {
  const supabase = await crearClienteSupabaseServidor();
  return ensureCustomerAccountWithRpc(() => supabase.rpc("ensure_cuenta_cliente_actual"));
}

export function esErrorClienteInactivo(error: unknown) {
  return typeof error === "object" && error !== null && "message" in error
    && (error as { message?: unknown }).message === "CLIENTE_INACTIVO";
}
