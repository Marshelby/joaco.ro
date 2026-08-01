import type { Metadata } from "next";
import { CategoryList } from "@/components/admin/category-list";
import { PageHeader } from "@/components/shared/page-header";
import { getAdminCategories } from "@/lib/admin-categories";
import { CATEGORY_CATALOG_MOCK } from "@/mocks/categories";

export const metadata: Metadata = { title: "Categorías" };

export default function AdminCategoriesPage() {
  return (
    <div className="space-y-8">
      <PageHeader title="Categorías" description="Organiza las categorías y subcategorías que acompañan a cada producto." />
      <CategoryList categories={getAdminCategories(CATEGORY_CATALOG_MOCK)} />
    </div>
  );
}
