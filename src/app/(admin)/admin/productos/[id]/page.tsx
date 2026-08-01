import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductFormPage } from "@/components/admin/product-form-page";
import { getAdminProductById } from "@/lib/admin-products";
import { HOME_PRODUCTS } from "@/mocks/products";

export const metadata: Metadata = { title: "Editar producto" };

export default async function EditAdminProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = getAdminProductById(HOME_PRODUCTS, id);

  if (!product) {
    notFound();
  }

  return <ProductFormPage mode="edit" product={product} />;
}
