import type { Metadata } from "next";
import { OrderViews } from "@/components/admin/order-views";
import { PossibleOrdersList } from "@/components/admin/possible-orders-list";
import { PageHeader } from "@/components/shared/page-header";

export const metadata: Metadata = { title: "Posibles pedidos", robots: { index: false, follow: false } };

export default async function PosiblesPedidosPage({ searchParams }: { searchParams: Promise<{ estado?: string; pagina?: string }> }) {
  return <div className="space-y-8">
    <PageHeader title="Pedidos" description="Revisa y confirma las solicitudes recibidas." />
    <OrderViews vista="posibles" />
    <PossibleOrdersList params={await searchParams} baseHref="/admin/posibles-pedidos" embedded />
  </div>;
}
