import type { Metadata } from "next";
import { connection } from "next/server";
import { Container } from "@/components/layout/container";
import { WhatsappForm } from "@/components/posibles-pedidos/whatsapp-form";
import { problemasConfiguracionRegistro } from "@/lib/posibles-pedidos/configuracion";
export const metadata: Metadata = { title: "Solicitar por WhatsApp", robots: { index: false, follow: false } };
export default async function WhatsappPage() {
  await connection();
  const problemas = problemasConfiguracionRegistro();
  if (problemas.length) console.error("[posibles-pedidos] Configuración de registro incompleta", { problemas });
  return <Container className="py-8 sm:py-12"><WhatsappForm registroDisponible={problemas.length === 0} /></Container>;
}
