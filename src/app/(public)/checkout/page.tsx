import type { Metadata } from "next";

import { CheckoutContent } from "@/components/checkout/checkout-content";
import { Container } from "@/components/layout/container";
import { crearClienteSupabaseServidor } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Checkout" };

type DireccionFila = { id: string; nombre: string | null; direccion: string; comuna: string; region: string; referencia: string | null };

export default async function CheckoutPage() {
  const supabase = await crearClienteSupabaseServidor();
  const { data: sesion } = await supabase.auth.getUser();
  if (!sesion.user) return <Container className="py-8 sm:py-12 lg:py-16"><CheckoutContent cliente={null} direcciones={[]} tieneSesion={false} /></Container>;

  const { data: cliente, error } = await supabase
    .from("clientes")
    .select("id,nombre,telefono,email")
    .eq("usuario_id", sesion.user.id)
    .eq("activo", true)
    .maybeSingle();

  if (error || !cliente) return <Container className="py-8 sm:py-12 lg:py-16"><CheckoutContent cliente={null} direcciones={[]} tieneSesion /></Container>;

  const { data: direcciones, error: errorDirecciones } = await supabase
    .from("direcciones_cliente")
    .select("id,nombre,direccion,comuna,region,referencia")
    .eq("cliente_id", cliente.id)
    .eq("activa", true)
    .order("es_principal", { ascending: false })
    .order("fecha_creacion", { ascending: true });

  if (errorDirecciones) throw errorDirecciones;
  return <Container className="py-8 sm:py-12 lg:py-16"><CheckoutContent cliente={cliente} direcciones={(direcciones as DireccionFila[] | null) ?? []} tieneSesion /></Container>;
}
