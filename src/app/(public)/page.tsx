import { Suspense } from "react";
import { unstable_rethrow } from "next/navigation";

import { Container } from "@/components/layout/container";
import { CategorySelector } from "@/components/home/category-selector";
import { CatalogSearchForm } from "@/components/catalog/catalog-search-form";
import { ProductSection } from "@/components/home/product-section";
import { SectionTitle } from "@/components/home/section-title";
import { B2bIntro } from "@/components/home/b2b-intro";
import { B2bBanner } from "@/components/home/b2b-banner";
import { EmptyState } from "@/components/feedback/empty-state";
import { FadeIn } from "@/components/ui/fade-in";
import { HomeLoadingSkeleton } from "@/components/feedback/home-loading-skeleton";
import { getStorefrontCategories, getStorefrontHomeSections, getStorefrontProducts } from "@/lib/storefront-catalog";

export const metadata = { alternates: { canonical: "/" } };

export default function HomePage() {
  return <Suspense fallback={<HomeLoadingSkeleton />}><HomeContent /></Suspense>;
}

async function HomeContent() {
  let products;
  let categories;
  try {
    [products, categories] = await Promise.all([getStorefrontProducts(), getStorefrontCategories()]);
  } catch (error) {
    unstable_rethrow(error);
    console.error("[storefront] No fue posible completar la portada", { type: error instanceof Error ? error.name : "UnknownError" });
    return <Container className="py-10 sm:py-14"><EmptyState title="No pudimos cargar el catálogo" description="Inténtalo nuevamente en unos momentos." /></Container>;
  }
  const homeSections = await getStorefrontHomeSections(products).catch((error: unknown) => {
    unstable_rethrow(error);
    return null;
  });

  return (
    <Container className="space-y-12 py-4 sm:space-y-16 sm:py-8 lg:py-10">
      <FadeIn><B2bBanner /></FadeIn>
      <CatalogSearchForm mode="submit-only" variant="home" />
      <FadeIn><B2bIntro /></FadeIn>
      {homeSections === null && <p role="status" className="text-sm text-muted-foreground">No pudimos cargar las secciones de inicio.</p>}
      {homeSections?.map((section) => section.products.length > 0 && (
        <ProductSection
          key={section.slug}
          id={`${section.slug}-title`}
          eyebrow={section.slug === "best-sellers" ? "Nuestra especialidad" : undefined}
          title={section.title}
          description={section.description ?? undefined}
          icon={section.icon}
          products={section.products}
          gridVariant="catalog"
        />
      ))}
      <section aria-labelledby="categories-title" className="space-y-8"><div id="categories-title"><SectionTitle eyebrow="Explora por categoría" title="Encuentra productos para cada ocasión" description="Revisa las categorías disponibles y descubre nuevos productos." /></div><CategorySelector categories={categories} products={products} /></section>
      <ProductSection id="all-products-title" title="Catálogo completo" description="Explora la selección disponible de Hidro Leufú." products={products} countLabel={`${products.length} productos`} gridVariant="catalog" />
    </Container>
  );
}
