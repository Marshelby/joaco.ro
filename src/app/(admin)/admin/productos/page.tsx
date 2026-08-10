import type { Metadata } from "next";
import { ProductList } from "@/components/admin/product-list";
import { PageHeader } from "@/components/shared/page-header";
import { ActionLink } from "@/components/ui/action-link";
import { ROUTES } from "@/config/routes";
import { obtenerProductosAdmin } from "@/lib/admin/catalogo";

export const metadata: Metadata = { title: "Productos" };

export default async function AdminProductsPage() {
  const productos = await obtenerProductosAdmin();
  return (
    <div className="space-y-8">
      <PageHeader title="Productos" description="Organiza la selección disponible en Hidro Leufú." actions={<ActionLink href={ROUTES.adminNewProduct}>Nuevo producto</ActionLink>} />
      <ProductList products={productos} />
    </div>
  );
}
