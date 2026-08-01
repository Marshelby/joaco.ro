import type { Metadata } from "next";
import { Container } from "@/components/layout/container";
import { CategorySelector } from "@/components/home/category-selector";
import { Hero } from "@/components/home/hero";
import { ProductRail } from "@/components/home/product-rail";
import { ProductSection } from "@/components/home/product-section";
import { SectionTitle } from "@/components/home/section-title";
import { HOME_CATEGORIES } from "@/mocks/home";
import { HOME_PRODUCTS } from "@/mocks/products";

export const metadata: Metadata = {
  title: "Inicio",
};

export default function HomePage() {
  const bestSellers = HOME_PRODUCTS.filter((product) => product.bestSeller);
  const opportunities = HOME_PRODUCTS.filter((product) => product.opportunity);
  const newArrivals = HOME_PRODUCTS.filter((product) => product.newArrival);

  return (
    <Container className="space-y-16 py-6 sm:space-y-20 sm:py-10 lg:py-12">
      <Hero image={{ src: "/images/hero/joaco-ro-hero-principal.webp", alt: "Selección de artículos útiles para el hogar, cocina y vida diaria sobre una mesa iluminada con luz natural." }} title={"Cosas útiles\na buenos precios."} description="Para el hogar y el día a día." />
      <ProductRail id="best-sellers-title" title="Productos destacados" description="Una selección para el hogar y el día a día." icon="best-sellers" products={bestSellers} ariaLabel="Productos destacados" />
      <ProductRail id="opportunities-title" title="Oportunidades" description="Productos útiles a precios convenientes." icon="opportunities" products={opportunities} ariaLabel="Oportunidades de la tienda" />
      <ProductRail id="new-arrivals-title" title="Novedades" description="Productos que se suman a la selección." icon="new-arrivals" products={newArrivals} ariaLabel="Productos nuevos" />
      <section aria-labelledby="categories-title" className="space-y-8"><div id="categories-title"><SectionTitle eyebrow="Exploración por tipo" title="Encuentra lo que buscas" description="Explora las categorías y encuentra más rápido eso que necesitas." /></div><CategorySelector categories={HOME_CATEGORIES} /></section>
      <ProductSection id="all-products-title" title="Todos los productos" description="Explora una selección de productos para el hogar y el día a día." products={HOME_PRODUCTS} countLabel={`${HOME_PRODUCTS.length} productos`} />
    </Container>
  );
}
