import { Suspense } from "react";
import { unstable_rethrow } from "next/navigation";

import { HomeSectionEditor, HomeSectionLoadError } from "@/components/admin/home-section-editor";
import { PageHeader } from "@/components/shared/page-header";
import { obtenerProductosDisponiblesParaSeccionesInicioAdmin, obtenerSeccionesInicioAdmin } from "@/lib/admin-home-sections";

export default function AdminHomeSectionsPage() {
  return (
    <div className="space-y-8">
      <PageHeader title="Secciones de inicio" description="Organiza las secciones y los productos destacados en la portada." />
      <Suspense fallback={<p role="status" className="text-sm text-muted-foreground">Cargando secciones de inicio…</p>}>
        <HomeSectionsContent />
      </Suspense>
    </div>
  );
}

async function HomeSectionsContent() {
  try {
    const [sections, products] = await Promise.all([
      obtenerSeccionesInicioAdmin(),
      obtenerProductosDisponiblesParaSeccionesInicioAdmin(),
    ]);
    return <HomeSectionEditor sections={sections} products={products} />;
  } catch (error) {
    unstable_rethrow(error);
    return <HomeSectionLoadError />;
  }
}
