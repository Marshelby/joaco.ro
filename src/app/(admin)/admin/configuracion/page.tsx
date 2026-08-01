import type { Metadata } from "next";
import { Settings } from "lucide-react";

import { AdminModuleIntro } from "@/components/admin/admin-module-intro";

export const metadata: Metadata = { title: "Configuración" };

export default function AdminSettingsPage() {
  return <AdminModuleIntro title="Configuración" description="Centraliza las definiciones que acompañan la operación de la tienda." surfaceTitle="Preferencias de la tienda" surfaceDescription="Este espacio reunirá los ajustes que se definan para la experiencia y la operación." icon={Settings} />;
}
