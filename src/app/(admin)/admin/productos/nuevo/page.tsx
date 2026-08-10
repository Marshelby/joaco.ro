import type { Metadata } from "next";
import { ProductFormPage } from "@/components/admin/product-form-page";
import { obtenerCategoriasAdmin } from "@/lib/admin/catalogo";

export const metadata: Metadata = { title: "Nuevo producto" };

export default async function NewAdminProductPage() {
  return <ProductFormPage mode="new" categorias={await obtenerCategoriasAdmin()} />;
}
