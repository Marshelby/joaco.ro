import type { Metadata } from "next";
import { ProductFormPage } from "@/components/admin/product-form-page";

export const metadata: Metadata = { title: "Nuevo producto" };

export default function NewAdminProductPage() {
  return <ProductFormPage mode="new" />;
}
