import type { Metadata } from "next";
import { connection } from "next/server";
import { Container } from "@/components/layout/container";
import { WhatsappForm } from "@/components/posibles-pedidos/whatsapp-form";
export const metadata: Metadata = { title: "Solicitar por WhatsApp", robots: { index: false, follow: false } };
export default async function WhatsappPage() {
  await connection();
  return <Container className="py-8 sm:py-12"><WhatsappForm /></Container>;
}
