import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductFormPage } from "@/components/admin/product-form-page";
import { obtenerCategoriasAdmin, obtenerProductoAdmin } from "@/lib/admin/catalogo";

export const metadata: Metadata = { title: "Editar producto" };

export default async function EditAdminProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [product, categorias] = await Promise.all([obtenerProductoAdmin(id), obtenerCategoriasAdmin()]);

  if (!product) {
    notFound();
  }

  return <ProductFormPage mode="edit" product={product} categorias={categorias} />;
}
