import type { Metadata } from "next";
import { PackageSearch } from "lucide-react";

import { PlaceholderPage } from "@/components/shared/placeholder-page";

export const metadata: Metadata = { title: "Detalle administrativo de pedido" };

export default function AdminOrderPlaceholderPage() {
  return <PlaceholderPage title="Detalle de pedido" description="La ruta está preparada para una futura revisión administrativa." emptyTitle="No hay un pedido cargado" emptyDescription="No se muestran ítems, pagos, stock ni acciones de aprobación en esta fase." icon={PackageSearch} />;
}
