import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ProductDetail } from "@/components/product/product-detail";
import { getProductBySlug, getRelatedProducts } from "@/lib/products";
import { HOME_PRODUCTS } from "@/mocks/products";

type ProductPageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = getProductBySlug(HOME_PRODUCTS, slug);

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
  const product = getProductBySlug(HOME_PRODUCTS, slug);

  if (!product) {
    notFound();
  }

  return <ProductDetail product={product} relatedProducts={getRelatedProducts(HOME_PRODUCTS, product)} />;
}
