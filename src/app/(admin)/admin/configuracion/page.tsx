import type { Metadata } from "next";

import { DeliveryDaysSettings } from "@/components/admin/delivery-days-settings";
import { PageHeader } from "@/components/shared/page-header";
import { obtenerDiasEntregaAdministrativos } from "@/lib/admin/dias-entrega";

export const metadata: Metadata = { title: "Configuración" };

export default async function AdminSettingsPage() {
  const diasEntrega = await obtenerDiasEntregaAdministrativos();

  return (
    <div className="space-y-8">
      <PageHeader title="Configuración" description="Centraliza las definiciones que acompañan la operación de la tienda." />
      <DeliveryDaysSettings dias={diasEntrega} />
    </div>
  );
}
