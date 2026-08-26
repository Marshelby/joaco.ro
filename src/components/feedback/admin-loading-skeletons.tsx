import type { ReactNode } from "react";

import { Skeleton } from "@/components/ui/skeleton";

function AdminDashboardSkeleton() {
  return <AdminLoadingFrame label="Cargando administración"><div aria-hidden="true" className="space-y-6"><PageHeaderSkeleton /><section className="space-y-6"><div className="space-y-3"><Skeleton className="h-8 w-48" /><Skeleton className="h-5 max-w-xl" /></div><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <MetricCardSkeleton key={index} />)}</div></section></div></AdminLoadingFrame>;
}

function AdminListSkeleton({ kind = "products" }: { kind?: "products" | "customers" | "orders" | "categories" }) {
  const rows = kind === "categories" ? 5 : 6;
  return <AdminLoadingFrame label="Cargando listado"><div aria-hidden="true" className="space-y-6"><PageHeaderSkeleton /><section className="space-y-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div className="space-y-2"><Skeleton className="h-8 w-52" /><Skeleton className="h-5 w-32" /></div>{kind !== "categories" ? <Skeleton className="h-11 w-full rounded-lg sm:w-64" /> : null}</div><div className="space-y-3">{Array.from({ length: rows }, (_, index) => <ListRowSkeleton key={index} kind={kind} />)}</div></section></div></AdminLoadingFrame>;
}

function AdminProductFormSkeleton() {
  return <AdminLoadingFrame label="Cargando formulario de producto"><div aria-hidden="true" className="space-y-6"><PageHeaderSkeleton /><div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_18rem]"><section className="space-y-5 rounded-xl border border-border bg-card p-5 sm:p-6"><Skeleton className="h-6 w-44" /><div className="grid gap-5 sm:grid-cols-2">{Array.from({ length: 6 }, (_, index) => <FieldSkeleton key={index} />)}</div><Skeleton className="h-36 w-full rounded-xl" /></section><aside className="space-y-5"><PanelSkeleton lines={3} /><PanelSkeleton lines={2} /></aside></div></div></AdminLoadingFrame>;
}

function AdminCustomerDetailSkeleton() {
  return <AdminLoadingFrame label="Cargando cliente"><div aria-hidden="true" className="space-y-6"><PageHeaderSkeleton /><div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem_22rem]"><PanelSkeleton lines={5} /><PanelSkeleton lines={4} /><PanelSkeleton lines={4} /></div><div className="grid gap-6 lg:grid-cols-2"><PanelSkeleton lines={5} /><PanelSkeleton lines={5} /></div></div></AdminLoadingFrame>;
}

function AdminOrderDetailSkeleton() {
  return <AdminLoadingFrame label="Cargando pedido"><div aria-hidden="true" className="space-y-6"><PageHeaderSkeleton /><div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]"><div className="space-y-6"><PanelSkeleton lines={5} /><PanelSkeleton lines={4} /></div><aside className="space-y-5"><PanelSkeleton lines={4} /><PanelSkeleton lines={3} /></aside></div></div></AdminLoadingFrame>;
}

function AdminDeliveryDaySkeleton() {
  return <AdminLoadingFrame label="Cargando jornada de entrega"><div aria-hidden="true" className="space-y-6"><PageHeaderSkeleton /><div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]"><div className="space-y-5">{Array.from({ length: 3 }, (_, index) => <PanelSkeleton key={index} lines={4} />)}</div><aside className="space-y-5"><PanelSkeleton lines={5} /><PanelSkeleton lines={4} /></aside></div></div></AdminLoadingFrame>;
}

function AdminSettingsSkeleton() {
  return <AdminLoadingFrame label="Cargando configuración"><div aria-hidden="true" className="space-y-6"><PageHeaderSkeleton /><PanelSkeleton lines={5} /></div></AdminLoadingFrame>;
}

function AdminLoadingFrame({ children, label }: { children: ReactNode; label: string }) {
  return <div aria-busy="true" aria-label={label}>{children}</div>;
}

function PageHeaderSkeleton() {
  return <header className="space-y-3 border-b border-border pb-6"><Skeleton className="h-9 w-56" /><Skeleton className="h-5 max-w-2xl" /></header>;
}

function MetricCardSkeleton() {
  return <section className="space-y-4 rounded-xl border border-border bg-card p-5 sm:p-6"><Skeleton className="h-5 w-28" /><Skeleton className="h-8 w-16" /><Skeleton className="h-4 w-4/5" /></section>;
}

function ListRowSkeleton({ kind }: { kind: "products" | "customers" | "orders" | "categories" }) {
  const isCategory = kind === "categories";
  return <article className="rounded-xl border border-border bg-card p-4 sm:p-5"><div className={isCategory ? "grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center" : "grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(8rem,.7fr)_auto] sm:items-center sm:gap-5"}><div className="space-y-2"><Skeleton className="h-5 w-48" /><Skeleton className="h-4 w-32" /></div>{!isCategory ? <div className="grid grid-cols-2 gap-3"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-full" /></div> : null}<div className="flex gap-2"><Skeleton className="h-7 w-20 rounded-full" /><Skeleton className="h-11 w-20 rounded-lg" /></div></div></article>;
}

function FieldSkeleton() {
  return <div className="space-y-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-11 w-full rounded-lg" /></div>;
}

function PanelSkeleton({ lines }: { lines: number }) {
  return <section className="space-y-4 rounded-xl border border-border bg-card p-5 sm:p-6"><Skeleton className="h-6 w-40" />{Array.from({ length: lines }, (_, index) => <Skeleton key={index} className="h-5 w-full last:w-2/3" />)}<Skeleton className="h-11 w-28 rounded-lg" /></section>;
}

export { AdminCustomerDetailSkeleton, AdminDashboardSkeleton, AdminDeliveryDaySkeleton, AdminListSkeleton, AdminOrderDetailSkeleton, AdminProductFormSkeleton, AdminSettingsSkeleton };
