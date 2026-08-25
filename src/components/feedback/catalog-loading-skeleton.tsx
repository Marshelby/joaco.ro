import { ProductGridSkeleton } from "@/components/feedback/product-card-skeleton";
import { Container } from "@/components/layout/container";
import { Skeleton } from "@/components/ui/skeleton";

function CatalogLoadingSkeleton() {
  return (
    <Container aria-busy="true" aria-label="Cargando catálogo" className="space-y-8 py-8 sm:space-y-10 sm:py-12 lg:py-14">
      <header aria-hidden="true" className="space-y-3 border-b border-border pb-6">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-9 w-48 sm:h-10 sm:w-56" />
        <Skeleton className="h-5 max-w-xl" />
      </header>

      <section aria-hidden="true" className="space-y-5 rounded-xl border border-border bg-card p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row">
          <Skeleton className="h-11 flex-1 rounded-lg" />
          <Skeleton className="h-11 w-full rounded-lg sm:w-52" />
        </div>
        <div className="flex gap-2 overflow-hidden">
          <Skeleton className="h-10 w-16 shrink-0 rounded-full" />
          <Skeleton className="h-10 w-28 shrink-0 rounded-full" />
          <Skeleton className="h-10 w-20 shrink-0 rounded-full" />
          <Skeleton className="h-10 w-24 shrink-0 rounded-full" />
        </div>
      </section>

      <section aria-hidden="true" className="space-y-5">
        <div className="flex flex-col gap-2 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
          <Skeleton className="h-6 w-32" />
        </div>
        <ProductGridSkeleton />
      </section>
    </Container>
  );
}

export { CatalogLoadingSkeleton };
