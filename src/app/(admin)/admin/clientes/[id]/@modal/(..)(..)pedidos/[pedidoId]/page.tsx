import type { Metadata } from "next";
import { AdminOrderDetail } from "@/components/admin/order-detail";

export const metadata: Metadata = { title: "Detalle de pedido" };

export default async function CustomerOrderModalPage({ params }: { params: Promise<{ id: string; pedidoId: string }> }) {
  const { pedidoId } = await params;
  return <AdminOrderDetail id={pedidoId} modal />;
}
