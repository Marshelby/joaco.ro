import type { Metadata } from "next";
import { ClipboardCheck } from "lucide-react";

import { Container } from "@/components/layout/container";
import { PlaceholderPage } from "@/components/shared/placeholder-page";

export const metadata: Metadata = { title: "Checkout" };

export default function CheckoutPage() {
  return <Container className="py-10 sm:py-16"><PlaceholderPage title="Finalizar compra" description="Revisa tus productos antes de continuar." emptyTitle="No hay productos para continuar" emptyDescription="Agrega productos a tu carrito para revisar tu compra." icon={ClipboardCheck} /></Container>;
}
