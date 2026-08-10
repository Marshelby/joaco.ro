import type { Metadata } from "next";
import { AdminOverview } from "@/components/admin/admin-overview";
import { PageHeader } from "@/components/shared/page-header";
import { obtenerCategoriasAdmin, obtenerProductosAdmin } from "@/lib/admin/catalogo";

export const metadata: Metadata = { title: "Administración" };

export default async function AdminPage() {
  const [productos, categorias] = await Promise.all([obtenerProductosAdmin(), obtenerCategoriasAdmin()]);
  return (
    <div className="space-y-8">
      <PageHeader title="Dashboard" description="Una vista simple para organizar el contenido de Hidro Leufú." />
      <AdminOverview estadisticas={{ productos: productos.length, categorias: categorias.length, activos: productos.filter((producto) => producto.activo).length, disponibles: productos.filter((producto) => producto.disponible).length }} />
    </div>
  );
}
