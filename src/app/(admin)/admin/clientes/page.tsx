import type { Metadata } from "next";
import { UsersRound } from "lucide-react";

import { PlaceholderPage } from "@/components/shared/placeholder-page";

export const metadata: Metadata = { title: "Clientes" };

export default function AdminCustomersPage() {
  return <PlaceholderPage title="Clientes" description="La gestión de clientes depende de la futura autenticación y datos reales." emptyTitle="Módulo en preparación" emptyDescription="No existen perfiles, historial ni datos personales demostrativos." icon={UsersRound} />;
}
