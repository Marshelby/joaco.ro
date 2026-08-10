import { Breadcrumbs } from "@/components/navigation/breadcrumbs";
import { PageHeader } from "@/components/shared/page-header";
import { ROUTES } from "@/config/routes";
import type { CategoriaAdmin, ProductoAdmin } from "@/lib/admin/catalogo";
import { ProductForm } from "./product-form";

export function ProductFormPage({ mode, product, categorias }: { mode: "new" | "edit"; product?: ProductoAdmin; categorias: CategoriaAdmin[] }) {
  const title = mode === "new" ? "Nuevo producto" : "Editar producto";
  return <div className="space-y-8"><Breadcrumbs items={[{ label: "Administrador", href: ROUTES.admin }, { label: "Productos", href: ROUTES.adminProducts }, { label: title }]} /><PageHeader title={title} description="Los cambios se guardan directamente en el catálogo real." /><ProductForm product={product} categorias={categorias} /></div>;
}
