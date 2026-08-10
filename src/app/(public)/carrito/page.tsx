import type { Metadata } from "next";

import { CartPageContent } from "@/components/cart/cart-page-content";
import { Container } from "@/components/layout/container";

export const metadata: Metadata = { title: "Carrito" };

export default function CartPage() {
  return <Container className="py-8 sm:py-12 lg:py-16"><CartPageContent /></Container>;
}
