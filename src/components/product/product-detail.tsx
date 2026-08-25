import { ProductGrid } from "@/components/home/product-grid";
import { CartProductAction } from "@/components/cart/cart-product-action";
import { Container } from "@/components/layout/container";
import { Breadcrumbs } from "@/components/navigation/breadcrumbs";
import { PublicLink } from "@/components/navigation/public-navigation-feedback";
import { ProductMedia } from "@/components/product/product-media";
import { actionLinkVariants } from "@/components/ui/action-link";
import { FadeIn } from "@/components/ui/fade-in";
import { ROUTES } from "@/config/routes";
import { getCatalogHref } from "@/lib/catalog";
import { formatCLP } from "@/lib/formatters";
import { getProductAvailabilityContent, getProductSaleUnitLabel } from "@/lib/products";
import { cn } from "@/lib/utils";
import type { MockProduct } from "@/types/product";

type ProductDetailProps = {
  product: MockProduct;
  relatedProducts: readonly MockProduct[];
};

export function ProductDetail({ product, relatedProducts }: ProductDetailProps) {
  const availability = getProductAvailabilityContent(product.availability);
  const categoryHref = getCatalogHref({ category: product.categorySlug });

  return (
    <Container className="py-8 sm:py-12 lg:py-16">
      <Breadcrumbs
        items={[
          { label: "Inicio", href: ROUTES.home },
          { label: "Catálogo", href: ROUTES.catalog },
          { label: product.category, href: categoryHref },
          { label: product.name },
        ]}
      />

      <div className="mt-6 lg:mt-8">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.08fr)_minmax(20rem,0.92fr)] lg:items-start lg:gap-12">
          <ProductMedia product={product} />

          <FadeIn className="min-w-0 lg:pt-2">
            <p className="text-sm font-medium text-muted-foreground">
              <PublicLink
                href={categoryHref}
                className="rounded-sm outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              >
                {product.category}
              </PublicLink>
              {product.subcategory ? ` · ${product.subcategory}` : null}
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              {product.name}
            </h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-muted-foreground">
              {product.description}
            </p>

            <dl className="mt-7 border-y border-border py-5">
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Precio con IVA · {getProductSaleUnitLabel(product.saleUnit)}</dt>
                <dd className="mt-1 text-3xl font-semibold tracking-tight text-foreground">
                  {formatCLP(product.unitPrice)}
                </dd>
              </div>
            </dl>

            <section className="mt-6" aria-labelledby="availability-title">
              <h2 id="availability-title" className="text-sm font-semibold text-foreground">
                {availability.label}
              </h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {availability.description}
              </p>
            </section>

            <CartProductAction product={product} className="mt-6 w-full sm:w-auto" />

            <section className="mt-7 rounded-xl border border-border bg-card p-5 sm:p-6" aria-labelledby="purchase-process-title">
              <h2 id="purchase-process-title" className="text-base font-semibold text-foreground">
                Solicitud de producto
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Al solicitar productos, revisaremos su disponibilidad y luego coordinaremos la confirmación, el pago y la entrega o el retiro.
              </p>
            </section>

            <section className="mt-6" aria-labelledby="delivery-title">
              <h2 id="delivery-title" className="text-base font-semibold text-foreground">
                Entrega o retiro
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Las opciones disponibles se coordinan una vez confirmada la solicitud.
              </p>
            </section>

            <PublicLink href={ROUTES.catalog} className={cn(actionLinkVariants({ variant: "secondary" }), "mt-7")}>Volver al catálogo</PublicLink>
          </FadeIn>
        </div>

        {relatedProducts.length > 0 ? (
          <section className="mt-14 border-t border-border pt-10 sm:mt-16 sm:pt-12" aria-labelledby="related-products-title">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
              <div className="max-w-2xl">
              <h2 id="related-products-title" className="text-2xl font-semibold tracking-tight text-foreground">
                Otros productos
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Descubre más opciones de esta categoría.
              </p>
              </div>
              <PublicLink href={categoryHref} className={cn(actionLinkVariants({ variant: "quiet" }), "self-start")}>Ver todos en {product.category}</PublicLink>
            </div>
            <div className="mt-6">
              <ProductGrid products={relatedProducts} variant="catalog" />
            </div>
          </section>
        ) : null}
      </div>
    </Container>
  );
}
