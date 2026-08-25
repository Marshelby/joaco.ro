import { Skeleton } from "@/components/ui/skeleton";

function ProductCardSkeleton() {
  return (
    <article aria-hidden="true" className="overflow-hidden rounded-2xl border border-border/70 bg-card">
      <Skeleton className="aspect-[4/3] rounded-none" />
      <div className="space-y-3 px-4 py-4 sm:px-5 sm:py-5">
        <Skeleton className="h-5 w-4/5" />
        <Skeleton className="h-4 w-2/5" />
        <Skeleton className="h-4 w-3/5" />
        <Skeleton className="mt-5 h-11 w-full rounded-lg" />
      </div>
    </article>
  );
}

function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div aria-hidden="true" className="grid min-w-0 max-w-full grid-cols-1 gap-4 min-[360px]:grid-cols-2 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 lg:gap-5">
      {Array.from({ length: count }, (_, index) => <ProductCardSkeleton key={index} />)}
    </div>
  );
}

export { ProductCardSkeleton, ProductGridSkeleton };
