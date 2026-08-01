import type { Metadata } from "next";
import { AdminOverview } from "@/components/admin/admin-overview";
import { PageHeader } from "@/components/shared/page-header";

export const metadata: Metadata = { title: "Administración" };

export default function AdminPage() {
  return (
    <div className="space-y-8">
      <PageHeader title="Dashboard" description="Una vista simple para organizar el contenido de JOACO RO." />
      <AdminOverview />
    </div>
  );
}
