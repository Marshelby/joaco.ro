import { Container } from "@/components/layout/container";
import { Skeleton } from "@/components/ui/skeleton";

function CheckoutLoadingSkeleton() {
  return (
    <Container aria-busy="true" aria-label="Preparando checkout" className="py-8 sm:py-12 lg:py-16">
      <div aria-hidden="true" className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-8">
        <section className="space-y-6">
          <header className="space-y-3"><Skeleton className="h-9 w-56" /><Skeleton className="h-5 max-w-lg" /></header>
          <CheckoutSectionSkeleton lines={3} />
          <CheckoutSectionSkeleton lines={2} select />
          <CheckoutSectionSkeleton lines={2} choices />
          <CheckoutSectionSkeleton lines={3} />
        </section>
        <aside className="space-y-4 rounded-2xl border border-border bg-card p-5 sm:p-6 lg:sticky lg:top-6">
          <Skeleton className="h-6 w-36" />
          <div className="space-y-4">{Array.from({ length: 3 }, (_, index) => <div key={index} className="flex justify-between gap-3 border-b border-border pb-3"><div className="flex-1 space-y-2"><Skeleton className="h-4 w-4/5" /><Skeleton className="h-3 w-2/5" /></div><Skeleton className="h-4 w-14" /></div>)}</div>
          <div className="flex justify-between border-y border-border py-4"><Skeleton className="h-4 w-24" /><Skeleton className="h-8 w-24" /></div>
          <Skeleton className="h-11 w-full rounded-lg" />
        </aside>
      </div>
    </Container>
  );
}

function CheckoutSectionSkeleton({ lines, select = false, choices = false }: { lines: number; select?: boolean; choices?: boolean }) {
  return (
    <section aria-hidden="true" className="space-y-4 rounded-xl border border-border bg-card p-4 sm:p-5">
      <Skeleton className="h-6 w-40" />
      {select ? <Skeleton className="h-11 w-full rounded-lg" /> : null}
      {choices ? <div className="flex flex-wrap gap-2"><Skeleton className="h-11 w-28 rounded-lg" /><Skeleton className="h-11 w-32 rounded-lg" /></div> : null}
      {!select && !choices ? <div className="grid gap-3 sm:grid-cols-3">{Array.from({ length: lines }, (_, index) => <div key={index} className="space-y-2"><Skeleton className="h-4 w-20" /><Skeleton className="h-5 w-full" /></div>)}</div> : null}
      {(select || choices) && Array.from({ length: lines }, (_, index) => <Skeleton key={index} className="h-4 w-3/5" />)}
    </section>
  );
}

export { CheckoutLoadingSkeleton };
