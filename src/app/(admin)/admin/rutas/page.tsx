import type { Metadata } from "next";
import { Route } from "lucide-react";

import { PlaceholderPage } from "@/components/shared/placeholder-page";

export const metadata: Metadata = { title: "Rutas" };

export default function AdminRoutesPage() {
  return <PlaceholderPage title="Rutas" description="Las rutas y zonas administrables se definirán en la fase logística." emptyTitle="Módulo en preparación" emptyDescription="No hay rutas, zonas ni cálculos de distancia implementados." icon={Route} />;
}
