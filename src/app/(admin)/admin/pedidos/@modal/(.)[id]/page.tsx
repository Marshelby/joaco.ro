import type { Metadata } from "next";
import { AdminOrderDetail } from "@/components/admin/order-detail";

export const metadata: Metadata = { title: "Detalle de pedido" };

export default async function OrderModalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AdminOrderDetail id={id} modal />;
}
