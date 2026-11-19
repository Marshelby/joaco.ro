import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ActionLink } from "@/components/ui/action-link";
import { ROUTES } from "@/config/routes";
import { ErrorState } from "@/components/feedback/error-state";
import { ProductFormPage } from "@/components/admin/product-form-page";
import { obtenerCategoriasAdmin, obtenerProductoAdmin, ProductoSinPresentacionPrincipalError } from "@/lib/admin/catalogo";

export const metadata: Metadata = { title: "Editar producto" };

export default async function EditAdminProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const volver = <ActionLink href={ROUTES.adminPublicManagerTab("productos")} variant="secondary">Volver al Gestor Público</ActionLink>;
  let product;
  let categorias;
  try {
    [product, categorias] = await Promise.all([obtenerProductoAdmin(id), obtenerCategoriasAdmin()]);
  } catch (error) {
    if (error instanceof ProductoSinPresentacionPrincipalError) {
      return (
        <div className="space-y-4">
          {volver}
          <ErrorState title="Producto incompleto" description="Este producto no tiene una presentación principal activa. Corrige la inconsistencia antes de editarlo." headingLevel="h1" />
        </div>
      );
    }
    throw error;
  }

  if (!product) {
    notFound();
  }

  return <ProductFormPage mode="edit" product={product} categorias={categorias} actions={volver} />;
}
