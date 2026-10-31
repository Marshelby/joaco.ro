import type { Metadata } from "next";
import { connection } from "next/server";
import { Container } from "@/components/layout/container";
import { WhatsappForm } from "@/components/posibles-pedidos/whatsapp-form";
import { configuracionRegistro } from "@/lib/posibles-pedidos/configuracion";
import { PublicLink } from "@/components/navigation/public-navigation-feedback";
import { ROUTES } from "@/config/routes";
export const metadata: Metadata = { title: "Solicitar por WhatsApp", robots: { index: false, follow: false } };
export default async function WhatsappPage() {
  await connection();
  return <Container className="py-8 sm:py-12">{configuracionRegistro() ? <WhatsappForm /> : <section className="mx-auto max-w-xl rounded-2xl border bg-card p-8"><h1 className="text-2xl font-semibold">WhatsApp estará disponible próximamente</h1><p className="mt-3 leading-7 text-muted-foreground">Por ahora puedes continuar con tu pedido por la web. Conservamos todos los productos de tu carrito.</p><PublicLink href={ROUTES.checkout} className="mt-6 inline-flex min-h-11 items-center font-medium text-primary">Realizar pedido por la web</PublicLink></section>}</Container>;
}
