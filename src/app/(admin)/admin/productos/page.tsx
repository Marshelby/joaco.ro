import type { Metadata } from "next";

export const metadata: Metadata = { title: "Productos" };

import Products from "@/components/admin/public-manager-products";

export default function AdminProductsPage() {
  return <Products />;
}
