import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ErrorState } from "@/components/feedback/error-state";
import { Container } from "@/components/layout/container";
import { ProductDetail } from "@/components/product/product-detail";
import { getStorefrontProduct, getStorefrontProducts, getStorefrontRelatedProducts } from "@/lib/storefront-catalog";

type ProductPageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  let product;
  try {
    product = await getStorefrontProduct(slug);
  } catch {
    return { title: "Catálogo" };
  }

  if (!product) {
    return { title: "Producto no encontrado" };
  }

  return {
    title: product.name,
    description: product.description,
    alternates: { canonical: `/catalogo/${product.slug}` },
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  let product;
  let products;
  try {
    [product, products] = await Promise.all([getStorefrontProduct(slug), getStorefrontProducts()]);
  } catch {
    return <Container className="py-10 sm:py-14"><ErrorState title="No pudimos cargar este producto" description="Inténtalo nuevamente en unos momentos." headingLevel="h1" /></Container>;
  }

  if (!product) {
    notFound();
  }

  return <ProductDetail product={product} relatedProducts={getStorefrontRelatedProducts(products, product)} />;
}
