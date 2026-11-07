import type { Metadata } from "next";
import Link from "next/link";

import Products from "@/components/admin/public-manager-products";
import Categories from "@/components/admin/public-manager-categories";
import HomeSections from "@/components/admin/public-manager-home-sections";
import { PageHeader } from "@/components/shared/page-header";
import { ROUTES } from "@/config/routes";

export const metadata: Metadata = { title: "Gestor público" };

const tabs = [
  { id: "productos", label: "Productos" },
  { id: "categorias", label: "Categorías" },
  { id: "secciones-inicio", label: "Secciones de inicio" },
] as const;

export default async function AdminPublicManagerPage({ searchParams }: {
  searchParams: Promise<{ pestana?: string | string[] }>;
}) {
  const { pestana } = await searchParams;
  const selected = tabs.find((tab) => tab.id === pestana)?.id ?? "productos";

  return (
    <div className="space-y-8">
      <PageHeader title="Gestor público" description="Administra el catálogo y las secciones de inicio de Hidro Leufú." />
      <nav aria-label="Secciones del gestor público" className="flex flex-wrap gap-1 rounded-lg border border-border bg-card p-1">
        {tabs.map((tab) => (
          <Link key={tab.id} href={`${ROUTES.adminPublicManager}?pestana=${tab.id}`} aria-current={selected === tab.id ? "page" : undefined} className={`inline-flex min-h-11 items-center rounded-lg px-4 py-2 text-sm font-medium outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 ${selected === tab.id ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
            {tab.label}
          </Link>
        ))}
      </nav>
      {selected === "categorias" ? <Categories /> : selected === "secciones-inicio" ? <HomeSections /> : <Products />}
    </div>
  );
}
