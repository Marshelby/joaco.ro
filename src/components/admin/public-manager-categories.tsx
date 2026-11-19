import { PageHeader } from "@/components/shared/page-header";
import { obtenerClasificacionAdmin } from "@/lib/admin/catalogo";

import { CategoryManager, CategoryManagerLoadError } from "./category-manager";

export default async function AdminCategoriesPage() {
  const datos = await obtenerClasificacionAdmin().catch(() => null);

  return (
    <div className="space-y-6">
      <PageHeader title="Categorías" description="Organiza cómo se agrupan y aparecen los productos en el catálogo." />
      {datos ? <CategoryManager {...datos} /> : <CategoryManagerLoadError />}
    </div>
  );
}
