import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { OrderDetail } from "@/components/account/order-detail";
import { getCustomerOrderById } from "@/lib/orders";
import { CUSTOMER_ORDERS_MOCK } from "@/mocks/orders";

export const metadata: Metadata = { title: "Detalle de pedido" };

export default async function CustomerOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = getCustomerOrderById(CUSTOMER_ORDERS_MOCK, id);

  if (!order) {
    notFound();
  }

  return <OrderDetail order={order} />;
}
