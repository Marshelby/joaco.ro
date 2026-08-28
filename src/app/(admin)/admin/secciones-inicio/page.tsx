import type { Metadata } from "next";
import { HomeSectionEditor } from "@/components/admin/home-section-editor";
import { PageHeader } from "@/components/shared/page-header";
import { obtenerProductosDisponiblesParaSeccionesInicioAdmin, obtenerSeccionesInicioAdmin } from "@/lib/admin-home-sections";

export const metadata: Metadata = { title: "Secciones Inicio" };

export default async function AdminHomeSectionsPage() {
  const [sections, products] = await Promise.all([
    obtenerSeccionesInicioAdmin(),
    obtenerProductosDisponiblesParaSeccionesInicioAdmin(),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader title="Secciones Inicio" description="Organiza los productos que aparecerán destacados en la portada." />
      <HomeSectionEditor sections={sections} products={products} />
    </div>
  );
}
