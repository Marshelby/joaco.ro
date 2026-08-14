"use client";

import Link from "next/link";
import { ShoppingCart } from "lucide-react";

import { CartLineItem } from "@/components/cart/cart-line-item";
import { useCart } from "@/components/cart/cart-provider";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/config/routes";
import { formatCLP } from "@/lib/formatters";

export function CartPageContent() {
  const { items, totalEstimado, isHydrated, vaciar } = useCart();

  if (!isHydrated) return <p className="text-sm text-muted-foreground">Cargando tu pedido…</p>;

  if (items.length === 0) {
    return (
      <section className="rounded-2xl border border-dashed border-border bg-card p-8 text-center sm:p-12">
        <ShoppingCart className="mx-auto size-7 text-muted-foreground" aria-hidden="true" />
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-foreground">Tu carrito está vacío</h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">Agrega productos del catálogo para comenzar.</p>
        <Button render={<Link href={ROUTES.catalog} />} className="mt-6">Ver catálogo</Button>
      </section>
    );
  }

  return (
    <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-8">
      <section className="min-w-0">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Tu pedido</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">Revisa los productos antes de continuar.</p>

        <div className="mt-5 divide-y divide-border rounded-2xl border border-border bg-card">
          {items.map((item) => <CartLineItem key={`${item.productoId}:${item.presentacionId}`} item={item} />)}
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <Button render={<Link href={ROUTES.catalog} />} variant="outline">Seguir viendo productos</Button>
          <Button type="button" variant="ghost" onClick={vaciar}>Vaciar pedido</Button>
        </div>
      </section>

      <aside className="rounded-2xl border border-border bg-card p-5 sm:p-6 lg:sticky lg:top-6">
        <h2 className="text-lg font-semibold text-foreground">Resumen</h2>
        <div className="mt-5 flex items-end justify-between gap-4 border-y border-border py-4">
          <span className="text-sm font-medium text-muted-foreground">Total estimado</span>
          <strong className="text-2xl tracking-tight text-foreground">{formatCLP(totalEstimado)}</strong>
        </div>
        <p className="mt-3 text-xs leading-5 text-muted-foreground">El total es referencial. Precio y disponibilidad se validarán antes de crear un pedido.</p>
        <Button render={<Link href={ROUTES.checkout} />} className="mt-5 w-full">Continuar pedido</Button>
        <p className="mt-2 text-center text-xs text-muted-foreground">Revisa tus datos antes de confirmar.</p>
      </aside>
    </div>
  );
}
