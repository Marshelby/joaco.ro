import { Breadcrumbs } from "@/components/navigation/breadcrumbs";
import { PageHeader } from "@/components/shared/page-header";
import { ROUTES } from "@/config/routes";
import { getProductFormValues } from "@/lib/admin-product-form";
import type { MockProduct } from "@/types/product";
import { ProductForm } from "./product-form";

type ProductFormPageProps =
  | { mode: "new"; product?: never }
  | { mode: "edit"; product: MockProduct };

export function ProductFormPage({ mode, product }: ProductFormPageProps) {
  const isNew = mode === "new";
  const title = isNew ? "Nuevo producto" : "Editar producto";

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Administrador", href: ROUTES.admin }, { label: "Productos", href: ROUTES.adminProducts }, { label: title }]} />
      <PageHeader title={title} description={isNew ? "Completa la información esencial para preparar un nuevo producto." : "Revisa y actualiza la información esencial del producto."} />
      <ProductForm values={getProductFormValues(product)} />
    </div>
  );
}
