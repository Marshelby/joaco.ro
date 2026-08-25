import { Container } from "@/components/layout/container";
import { Skeleton } from "@/components/ui/skeleton";

function ProductDetailLoadingSkeleton() {
  return (
    <Container aria-busy="true" aria-label="Cargando producto" className="py-8 sm:py-12 lg:py-16">
      <div aria-hidden="true" className="flex gap-2">
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-24" />
      </div>

      <div aria-hidden="true" className="mt-6 grid gap-8 lg:mt-8 lg:grid-cols-[minmax(0,1.08fr)_minmax(20rem,0.92fr)] lg:items-start lg:gap-12">
        <Skeleton className="aspect-[4/3] rounded-2xl" />
        <div className="min-w-0 space-y-5 lg:pt-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-10 w-4/5 sm:w-3/5" />
          <div className="space-y-2"><Skeleton className="h-5 w-full" /><Skeleton className="h-5 w-11/12" /><Skeleton className="h-5 w-2/3" /></div>
          <div className="space-y-3 border-y border-border py-5"><Skeleton className="h-4 w-48" /><Skeleton className="h-9 w-32" /></div>
          <div className="space-y-2"><Skeleton className="h-5 w-36" /><Skeleton className="h-5 w-full" /></div>
          <Skeleton className="h-11 w-full rounded-lg sm:w-56" />
          <div className="space-y-3 rounded-xl border border-border p-5 sm:p-6"><Skeleton className="h-5 w-44" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-4/5" /></div>
        </div>
      </div>
    </Container>
  );
}

export { ProductDetailLoadingSkeleton };
