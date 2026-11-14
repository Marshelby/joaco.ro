import type { Metadata } from "next";

import InternalManagerAdministrators from "@/components/admin/internal-manager-administrators";
import InternalManagerDrivers from "@/components/admin/internal-manager-drivers";
import { InternalManagerSection } from "@/components/admin/internal-manager-section";
import { DeliveryDaysSettings } from "@/components/admin/delivery-days-settings";
import { PageHeader } from "@/components/shared/page-header";
import { obtenerDiasEntregaAdministrativos } from "@/lib/admin/dias-entrega";

export const metadata: Metadata = { title: "Gestor interno" };

export default async function AdminInternalManagerPage({ searchParams }: {
  searchParams: Promise<{ seccion?: string | string[]; resultado?: string | string[]; q?: string | string[] }>;
}) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : undefined;
  const resultado = typeof params.resultado === "string" ? params.resultado : undefined;
  const seccion = typeof params.seccion === "string" ? params.seccion : undefined;
  const dias = await obtenerDiasEntregaAdministrativos();

  return (
    <div className="space-y-6">
      <PageHeader title="Gestor interno" description="Administra el equipo y las fechas habilitadas de reparto de Hidro Leufú." />
      <div className="space-y-3">
        <InternalManagerSection id="administradores" title="Administradores" description="Usuarios con rol administrador en Hidro Leufú." defaultOpen={!seccion || seccion === "administradores"}>
          <InternalManagerAdministrators />
        </InternalManagerSection>
        <InternalManagerSection id="repartidores" title="Repartidores" description="Búsqueda de usuarios y permisos del equipo de reparto." defaultOpen={seccion === "repartidores" || !!q || !!resultado}>
          <InternalManagerDrivers q={q} resultado={resultado} />
        </InternalManagerSection>
        <InternalManagerSection id="fechas" title="Fechas habilitadas de reparto" description="Días activos y hora límite para pedidos del mismo día." defaultOpen={seccion === "fechas"}>
          <DeliveryDaysSettings dias={dias} />
        </InternalManagerSection>
      </div>
    </div>
  );
}
