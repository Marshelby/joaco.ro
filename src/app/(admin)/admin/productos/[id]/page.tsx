import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ErrorState } from "@/components/feedback/error-state";
import { ProductFormPage } from "@/components/admin/product-form-page";
import { obtenerCategoriasAdmin, obtenerProductoAdmin, ProductoSinPresentacionPrincipalError } from "@/lib/admin/catalogo";

export const metadata: Metadata = { title: "Editar producto" };

export default async function EditAdminProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let product;
  let categorias;
  try {
    [product, categorias] = await Promise.all([obtenerProductoAdmin(id), obtenerCategoriasAdmin()]);
  } catch (error) {
    if (error instanceof ProductoSinPresentacionPrincipalError) {
      return <ErrorState title="Producto incompleto" description="Este producto no tiene una presentación principal activa. Corrige la inconsistencia antes de editarlo." headingLevel="h1" />;
    }
    throw error;
  }

  if (!product) {
    notFound();
  }

  return <ProductFormPage mode="edit" product={product} categorias={categorias} />;
}
