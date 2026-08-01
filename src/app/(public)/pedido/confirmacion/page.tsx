import type { Metadata } from "next";
import { CircleCheck } from "lucide-react";

import { Container } from "@/components/layout/container";
import { PlaceholderPage } from "@/components/shared/placeholder-page";

export const metadata: Metadata = { title: "Confirmación de pedido" };

export default function OrderConfirmationPage() {
  return <Container className="py-10 sm:py-16"><PlaceholderPage title="Confirmación de pedido" description="Aquí podrás revisar los detalles de tu compra." emptyTitle="No encontramos una compra para mostrar" emptyDescription="Vuelve al inicio para descubrir productos." icon={CircleCheck} /></Container>;
}
