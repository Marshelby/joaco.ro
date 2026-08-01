import type { Metadata } from "next";
import { HomeSectionEditor } from "@/components/admin/home-section-editor";
import { PageHeader } from "@/components/shared/page-header";
import { resolveHomeSections } from "@/lib/admin-home-sections";
import { ADMIN_HOME_SECTIONS_MOCK } from "@/mocks/admin-home-sections";
import { HOME_PRODUCTS } from "@/mocks/products";

export const metadata: Metadata = { title: "Secciones Inicio" };

export default function AdminHomeSectionsPage() {
  return (
    <div className="space-y-8">
      <PageHeader title="Secciones Inicio" description="Organiza los productos que aparecerán destacados en la portada." />
      <HomeSectionEditor sections={resolveHomeSections(ADMIN_HOME_SECTIONS_MOCK, HOME_PRODUCTS)} products={HOME_PRODUCTS} />
    </div>
  );
}
