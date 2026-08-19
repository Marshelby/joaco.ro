import type { Metadata } from "next";
import { randomUUID } from "node:crypto";

import { CheckoutContent, type EstadoCuentaCheckout } from "@/components/checkout/checkout-content";
import { Container } from "@/components/layout/container";
import { ensureCurrentCustomerAccount, esErrorClienteInactivo } from "@/lib/account/ensure-customer-account";
import { obtenerFechasEntregaDisponibles } from "@/lib/delivery-availability";
import { crearClienteSupabaseServidor } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Checkout" };

type DireccionFila = { id: string; nombre: string | null; destinatario: string | null; direccion: string; comuna: string; region: string; referencia: string | null; latitud: number | null; longitud: number | null; zonas_entrega: { nombre: string }[] };

function checkoutSinCuenta(claveIdempotencia: string, estadoCuenta: EstadoCuentaCheckout) {
  return <Container className="py-8 sm:py-12 lg:py-16"><CheckoutContent claveIdempotencia={claveIdempotencia} cliente={null} direcciones={[]} fechasEntrega={[]} estadoCuenta={estadoCuenta} /></Container>;
}

export default async function CheckoutPage() {
  const claveIdempotencia = randomUUID();
  const supabase = await crearClienteSupabaseServidor();
  const { data: sesion } = await supabase.auth.getUser();
  if (!sesion.user) return checkoutSinCuenta(claveIdempotencia, "guest");

  let cuenta;
  try {
    cuenta = await ensureCurrentCustomerAccount();
  } catch (error) {
    return checkoutSinCuenta(claveIdempotencia, esErrorClienteInactivo(error) ? "inactive_customer" : "account_error");
  }

  if (cuenta.rol === "admin") return checkoutSinCuenta(claveIdempotencia, "admin");
  if (!cuenta.clienteActivo || !cuenta.clienteId) return checkoutSinCuenta(claveIdempotencia, "inactive_customer");

  const { data: cliente, error } = await supabase
    .from("clientes")
    .select("id,nombre,telefono,email")
    .eq("id", cuenta.clienteId)
    .eq("activo", true)
    .maybeSingle();

  if (error || !cliente) return checkoutSinCuenta(claveIdempotencia, "account_error");

  const { data: direcciones, error: errorDirecciones } = await supabase
    .from("direcciones_cliente")
    .select("id,nombre,destinatario,direccion,comuna,region,referencia,latitud,longitud,zonas_entrega(nombre)")
    .eq("cliente_id", cliente.id)
    .eq("activa", true)
    .order("es_principal", { ascending: false })
    .order("fecha_creacion", { ascending: true });

  if (errorDirecciones) throw errorDirecciones;
  const addresses = ((direcciones as DireccionFila[] | null) ?? []).map((address) => ({ ...address, latitud: address.latitud === null ? null : Number(address.latitud), longitud: address.longitud === null ? null : Number(address.longitud) }));
  const fechasEntrega = await obtenerFechasEntregaDisponibles();
  return <Container className="py-8 sm:py-12 lg:py-16"><CheckoutContent claveIdempotencia={claveIdempotencia} cliente={cliente} direcciones={addresses} fechasEntrega={fechasEntrega} estadoCuenta="active_customer" /></Container>;
}
