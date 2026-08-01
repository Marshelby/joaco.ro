import type { Metadata } from "next";
import { ShoppingCart } from "lucide-react";

import { Container } from "@/components/layout/container";
import { PlaceholderPage } from "@/components/shared/placeholder-page";

export const metadata: Metadata = { title: "Carrito" };

export default function CartPage() {
  return <Container className="py-10 sm:py-16"><PlaceholderPage title="Carrito" description="Revisa los productos que quieres llevar." emptyTitle="Tu carrito está vacío" emptyDescription="No tienes productos guardados por ahora." icon={ShoppingCart} /></Container>;
}
