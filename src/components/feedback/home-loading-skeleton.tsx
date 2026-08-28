import { ProductGridSkeleton } from "@/components/feedback/product-card-skeleton";
import { Container } from "@/components/layout/container";
import { Skeleton } from "@/components/ui/skeleton";

function HomeLoadingSkeleton() {
  return (
    <Container aria-busy="true" aria-label="Cargando productos" className="space-y-12 py-4 sm:space-y-16 sm:py-8 lg:py-10">
      <section aria-hidden="true" className="space-y-4 rounded-2xl border border-border bg-card p-6 sm:p-8"><Skeleton className="h-8 max-w-md" /><Skeleton className="h-5 max-w-2xl" /><Skeleton className="h-11 w-36 rounded-lg" /></section>
      <HomeProductSectionSkeleton />
      <HomeProductSectionSkeleton />
      <HomeProductSectionSkeleton />
      <HomeProductSectionSkeleton />
      <section aria-hidden="true" className="space-y-6"><div className="space-y-3"><Skeleton className="h-4 w-36" /><Skeleton className="h-8 max-w-sm" /></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 lg:gap-5">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="aspect-[16/9] rounded-xl" />)}</div></section>
    </Container>
  );
}

function HomeProductSectionSkeleton() {
  return <section aria-hidden="true" className="space-y-6"><div className="space-y-3"><Skeleton className="h-4 w-28" /><Skeleton className="h-8 max-w-sm" /><Skeleton className="h-5 max-w-xl" /></div><ProductGridSkeleton count={4} /></section>;
}

export { HomeLoadingSkeleton };
