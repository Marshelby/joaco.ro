import type { Metadata } from "next";
import { ProductList } from "@/components/admin/product-list";
import { PageHeader } from "@/components/shared/page-header";
import { ActionLink } from "@/components/ui/action-link";
import { ROUTES } from "@/config/routes";
import { getAdminProducts } from "@/lib/admin-products";
import { HOME_PRODUCTS } from "@/mocks/products";

export const metadata: Metadata = { title: "Productos" };

export default function AdminProductsPage() {
  return (
    <div className="space-y-8">
      <PageHeader title="Productos" description="Organiza la selección disponible en JOACO RO." actions={<ActionLink href={ROUTES.adminNewProduct}>Nuevo producto</ActionLink>} />
      <ProductList products={getAdminProducts(HOME_PRODUCTS)} />
    </div>
  );
}
