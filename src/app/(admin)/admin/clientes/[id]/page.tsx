import type { Metadata } from "next";
import { AdminCustomerDetail } from "@/components/admin/customer-detail";

export const metadata: Metadata = { title: "Cliente" };

export default async function AdminCustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AdminCustomerDetail id={id} cabeceraCompacta />;
}
