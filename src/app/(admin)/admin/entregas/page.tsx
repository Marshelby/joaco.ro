import type { Metadata } from "next";
import { PackageCheck } from "lucide-react";

import { PlaceholderPage } from "@/components/shared/placeholder-page";

export const metadata: Metadata = { title: "Entregas" };

export default function AdminDeliveriesPage() {
  return <PlaceholderPage title="Entregas" description="La operación de entregas se incorporará después de la gestión de pedidos." emptyTitle="Módulo en preparación" emptyDescription="No hay programación, capacidad ni entregas reales disponibles." icon={PackageCheck} />;
}
