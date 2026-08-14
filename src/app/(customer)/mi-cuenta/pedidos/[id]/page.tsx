import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { OrderDetail } from "@/components/account/order-detail";
import { obtenerPedidoCuenta } from "@/lib/account/pedidos";

export const metadata: Metadata = { title: "Detalle de pedido" };

export default async function CustomerOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await obtenerPedidoCuenta(id);

  if (!order) {
    notFound();
  }

  return <OrderDetail order={order} />;
}
