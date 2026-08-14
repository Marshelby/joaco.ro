import { cache } from "react";

import { crearClienteSupabaseServidor } from "@/lib/supabase/server";

export type IdentidadCuenta = {
  rol: "cliente" | "admin";
  nombreMostrado: string;
  email: string;
};

export type ClienteCuenta = {
  id: string;
  nombre: string;
  telefono: string | null;
  email: string | null;
};

type CuentaActual = {
  identidad: IdentidadCuenta;
  cliente: ClienteCuenta | null;
};

const obtenerCuentaActual = cache(async (): Promise<CuentaActual | null> => {
  const supabase = await crearClienteSupabaseServidor();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return null;

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("rol,nombre")
    .eq("usuario_id", user.id)
    .maybeSingle();

  if (!perfil || (perfil.rol !== "cliente" && perfil.rol !== "admin")) return null;

  if (perfil.rol === "admin") {
    return {
      identidad: {
        rol: "admin",
        nombreMostrado: perfil.nombre?.trim() || user.email,
        email: user.email,
      },
      cliente: null,
    };
  }

  const { data: cliente } = await supabase
    .from("clientes")
    .select("id,nombre,telefono,email")
    .eq("usuario_id", user.id)
    .eq("activo", true)
    .maybeSingle();

  return {
    identidad: {
      rol: "cliente",
      nombreMostrado: cliente?.nombre?.trim() || perfil.nombre?.trim() || user.email,
      email: user.email,
    },
    cliente,
  };
});

export const obtenerIdentidadActual = cache(async (): Promise<IdentidadCuenta | null> => {
  const cuenta = await obtenerCuentaActual();
  return cuenta?.identidad ?? null;
});

export const obtenerClienteActual = cache(async (): Promise<ClienteCuenta | null> => {
  const cuenta = await obtenerCuentaActual();
  return cuenta?.identidad.rol === "cliente" ? cuenta.cliente : null;
});
