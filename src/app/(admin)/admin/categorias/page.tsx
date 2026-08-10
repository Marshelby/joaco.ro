import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { obtenerCategoriasAdmin } from "@/lib/admin/catalogo";

export const metadata: Metadata = { title: "Categorías" };

export default async function AdminCategoriesPage() {
  const categorias = await obtenerCategoriasAdmin();
  return (
    <div className="space-y-8">
      <PageHeader title="Categorías" description="Organiza las categorías y subcategorías que acompañan a cada producto." />
      <section className="space-y-3">{categorias.map((categoria) => <article key={categoria.id} className="rounded-xl border border-border bg-card p-5"><h2 className="font-semibold">{categoria.nombre}</h2><p className="mt-1 text-sm text-muted-foreground">{categoria.slug} · orden {categoria.orden} · {categoria.activa ? "Activa" : "Inactiva"}</p><p className="mt-3 text-sm">{categoria.descripcion}</p></article>)}</section>
    </div>
  );
}
