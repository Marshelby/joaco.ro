import type { ReactNode } from "react";

import { Skeleton } from "@/components/ui/skeleton";

function AccountDashboardSkeleton() {
  return <LoadingFrame label="Cargando mi cuenta"><div className="space-y-8" aria-hidden="true"><PageHeaderSkeleton /><section className="space-y-6 border-b border-border pb-8"><div className="flex items-center gap-4"><Skeleton className="size-14 rounded-full" /><div className="space-y-2"><Skeleton className="h-7 w-44" /><Skeleton className="h-4 w-28" /></div></div><div className="grid gap-5 sm:grid-cols-3">{Array.from({ length: 3 }, (_, index) => <DataLineSkeleton key={index} />)}</div></section><div className="grid gap-5 lg:grid-cols-2"><AccountCardSkeleton /><AccountCardSkeleton /></div><AccountCardSkeleton /></div></LoadingFrame>;
}

function AccountOrdersSkeleton() {
  return <LoadingFrame label="Cargando pedidos"><div aria-hidden="true" className="space-y-6"><PageHeaderSkeleton /><div className="space-y-4">{Array.from({ length: 4 }, (_, index) => <OrderCardSkeleton key={index} />)}</div></div></LoadingFrame>;
}

function AccountOrderDetailSkeleton() {
  return <LoadingFrame label="Cargando detalle de pedido"><div aria-hidden="true" className="space-y-8"><header className="space-y-5 border-b border-border pb-6"><Skeleton className="h-5 w-40" /><div className="flex flex-wrap justify-between gap-4"><div className="space-y-2"><Skeleton className="h-9 w-36" /><Skeleton className="h-4 w-44" /></div><Skeleton className="h-7 w-24 rounded-full" /></div></header><div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_20rem]"><div className="space-y-8"><PanelSkeleton lines={4} /><PanelSkeleton lines={3} /></div><aside className="space-y-5"><PanelSkeleton lines={2} /><PanelSkeleton lines={4} /><PanelSkeleton lines={3} /></aside></div></div></LoadingFrame>;
}

function AccountAddressesSkeleton() {
  return (
    <LoadingFrame label="Cargando direcciones">
      <div aria-hidden="true" className="space-y-6">
        <PageHeaderSkeleton />
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,22rem),1fr))] gap-4">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              <div className="flex items-center justify-between gap-3 border-b border-border/70 bg-primary/[0.03] px-4 py-2.5 sm:px-5">
                <Skeleton className="h-5 w-36 max-w-1/2" />
                <Skeleton className="h-9 w-20 rounded-lg" />
              </div>
              <div className="space-y-3 px-4 py-3 sm:px-5">
                <div className="space-y-1">
                  <Skeleton className="h-5 w-4/5" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-36" />
                </div>
              </div>
              <div className="flex justify-end border-t border-border/70 px-4 py-1.5 sm:px-5">
                <Skeleton className="h-9 w-24 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </LoadingFrame>
  );
}

function AccountAddressFormSkeleton() {
  return (
    <LoadingFrame label="Cargando dirección">
      <div aria-hidden="true" className="space-y-6">
        <PageHeaderSkeleton />
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-11 w-full rounded-lg" />
              </div>
            ))}
            <div className="space-y-3 rounded-xl border border-border/70 bg-muted/30 p-3 sm:col-span-2 sm:p-4">
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-80 w-full rounded-xl" />
            </div>
          </div>
          <div className="border-t border-border/70 bg-primary/[0.03] px-4 py-3 sm:px-5">
            <Skeleton className="h-11 w-44 rounded-lg" />
          </div>
        </div>
      </div>
    </LoadingFrame>
  );
}

function LoadingFrame({ children, label }: { children: ReactNode; label: string }) {
  return <div aria-busy="true" aria-label={label}>{children}</div>;
}

function PageHeaderSkeleton() {
  return <header className="space-y-3 border-b border-border pb-6"><Skeleton className="h-9 w-48" /><Skeleton className="h-5 max-w-xl" /></header>;
}

function DataLineSkeleton() {
  return <div className="space-y-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-5 w-4/5" /></div>;
}

function AccountCardSkeleton() {
  return <section className="space-y-4 rounded-xl border border-border bg-card p-5 sm:p-6"><Skeleton className="h-5 w-36" /><Skeleton className="h-6 w-3/5" /><Skeleton className="h-4 w-4/5" /><Skeleton className="h-11 w-28 rounded-lg" /></section>;
}

function OrderCardSkeleton() {
  return <article className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"><div className="flex justify-between gap-3 border-b border-border/70 bg-primary/[0.03] px-4 py-3 sm:px-5"><div className="space-y-2"><Skeleton className="h-6 w-32" /><Skeleton className="h-4 w-40" /></div><Skeleton className="h-7 w-24 rounded-full" /></div><div className="grid gap-4 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-5"><div className="space-y-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-4 w-4/5" /><Skeleton className="h-4 w-36" /></div><div className="flex items-center justify-between gap-6"><Skeleton className="h-8 w-24" /><Skeleton className="h-11 w-28 rounded-xl" /></div></div></article>;
}

function PanelSkeleton({ lines }: { lines: number }) {
  return <section className="space-y-4 rounded-xl border border-border bg-card p-5 sm:p-6"><Skeleton className="h-6 w-36" />{Array.from({ length: lines }, (_, index) => <Skeleton key={index} className="h-5 w-full last:w-3/5" />)}</section>;
}

export { AccountAddressFormSkeleton, AccountAddressesSkeleton, AccountDashboardSkeleton, AccountOrderDetailSkeleton, AccountOrdersSkeleton };
