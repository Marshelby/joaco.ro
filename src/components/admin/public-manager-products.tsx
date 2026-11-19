import { ProductList } from "@/components/admin/product-list";
import { PageHeader } from "@/components/shared/page-header";
import { ActionLink } from "@/components/ui/action-link";
import { ROUTES } from "@/config/routes";
import { obtenerCategoriasAdmin, obtenerProductosAdmin } from "@/lib/admin/catalogo";

export default async function AdminProductsPage({ gestor = false }: { gestor?: boolean }) {
  const [productos, categorias] = await Promise.all([
    obtenerProductosAdmin(),
    gestor ? obtenerCategoriasAdmin() : undefined,
  ]);
  return (
    <div className="space-y-8">
      <PageHeader title="Productos" description="Organiza la selección disponible en Hidro Leufú." actions={<ActionLink href={ROUTES.adminNewProduct}>Nuevo producto</ActionLink>} />
      <ProductList products={productos} categorias={categorias} />
    </div>
  );
}
