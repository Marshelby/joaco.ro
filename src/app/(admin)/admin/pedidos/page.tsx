import type { Metadata } from "next";
import { PackageSearch } from "lucide-react";

import { PlaceholderPage } from "@/components/shared/placeholder-page";

export const metadata: Metadata = { title: "Pedidos" };

export default function AdminOrdersPage() {
  return <PlaceholderPage title="Pedidos" description="La revisión administrativa de solicitudes se desarrollará en la fase de gestión de pedidos." emptyTitle="No hay pedidos cargados" emptyDescription="Esta fase no simula pedidos, estados ni aprobaciones." icon={PackageSearch} />;
}
