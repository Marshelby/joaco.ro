import { Container } from "@/components/layout/container";
import { CategorySelector } from "@/components/home/category-selector";
import { ProductSection } from "@/components/home/product-section";
import { SectionTitle } from "@/components/home/section-title";
import { B2bIntro } from "@/components/home/b2b-intro";
import { B2bBanner } from "@/components/home/b2b-banner";
import { EmptyState } from "@/components/feedback/empty-state";
import { getStorefrontCategories, getStorefrontProducts } from "@/lib/storefront-catalog";

export const metadata = { alternates: { canonical: "/" } };

export default async function HomePage() {
  let products;
  let categories;
  try {
    [products, categories] = await Promise.all([getStorefrontProducts(), getStorefrontCategories()]);
  } catch {
    return <Container className="py-10 sm:py-14"><EmptyState title="No pudimos cargar el catálogo" description="Inténtalo nuevamente en unos momentos." /></Container>;
  }
  const bestSellers = products.filter((product) => product.bestSeller);
  const featured = products.filter((product) => product.featured);
  const newArrivals = products.filter((product) => product.newArrival);

  return (
    <Container className="space-y-12 py-4 sm:space-y-16 sm:py-8 lg:py-10">
      <B2bBanner />
      <B2bIntro />
      <ProductSection id="best-sellers-title" eyebrow="Nuestra especialidad" title="Hidropónicos" description="Frescos, seleccionados y preparados para abastecer tu negocio." products={bestSellers} gridVariant="catalog" />
      <ProductSection id="opportunities-title" title="Más productos frescos" description="Encuentra productos para complementar tu pedido." products={featured} gridVariant="catalog" />
      <ProductSection id="new-arrivals-title" title="Recién seleccionados" description="Nuevos productos que se suman a nuestra selección." products={newArrivals} gridVariant="catalog" />
      <section aria-labelledby="categories-title" className="space-y-8"><div id="categories-title"><SectionTitle eyebrow="Explora por categoría" title="Encuentra productos para cada ocasión" description="Revisa las categorías disponibles y descubre nuevos productos." /></div><CategorySelector categories={categories} products={products} /></section>
      <ProductSection id="all-products-title" title="Catálogo completo" description="Explora la selección disponible de Hidro Leufú." products={products} countLabel={`${products.length} productos`} gridVariant="catalog" />
    </Container>
  );
}
