import "server-only";

import { cache } from "react";

import { ensureCurrentCustomerAccount, esErrorClienteInactivo } from "@/lib/account/ensure-customer-account";
import { crearClienteSupabaseServidor } from "@/lib/supabase/server";

export type EstadoCuentaDashboard = "guest" | "admin" | "inactive_customer" | "account_error" | "active_customer";

export type CuentaDashboard = {
  estado: EstadoCuentaDashboard;
  email: string | null;
  nombreAdmin: string | null;
  cliente: { id: string; nombre: string; telefono: string | null; email: string | null } | null;
};

export const obtenerCuentaDashboard = cache(async (): Promise<CuentaDashboard> => {
  const supabase = await crearClienteSupabaseServidor();
  const { data: sesion } = await supabase.auth.getUser();
  if (!sesion.user) return { estado: "guest", email: null, nombreAdmin: null, cliente: null };

  let cuenta;
  try {
    cuenta = await ensureCurrentCustomerAccount();
  } catch (error) {
    return {
      estado: esErrorClienteInactivo(error) ? "inactive_customer" : "account_error",
      email: sesion.user.email ?? null,
      nombreAdmin: null,
      cliente: null,
    };
  }

  if (cuenta.rol === "admin") {
    const { data: perfil } = await supabase.from("perfiles").select("nombre").eq("usuario_id", sesion.user.id).maybeSingle();
    return { estado: "admin", email: sesion.user.email ?? null, nombreAdmin: perfil?.nombre?.trim() || null, cliente: null };
  }

  if (!cuenta.clienteActivo || !cuenta.clienteId) {
    return { estado: "inactive_customer", email: sesion.user.email ?? null, nombreAdmin: null, cliente: null };
  }

  const { data: cliente, error } = await supabase
    .from("clientes")
    .select("id,nombre,telefono,email")
    .eq("id", cuenta.clienteId)
    .eq("activo", true)
    .maybeSingle();

  if (error || !cliente) return { estado: "account_error", email: sesion.user.email ?? null, nombreAdmin: null, cliente: null };

  return { estado: "active_customer", email: sesion.user.email ?? null, nombreAdmin: null, cliente };
});
