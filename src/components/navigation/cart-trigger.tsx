"use client";

import { Dialog } from "@base-ui/react/dialog";
import { ShoppingCart } from "lucide-react";

import { useCartPreviewHandle } from "@/components/cart/cart-preview";
import { useCart } from "@/components/cart/cart-provider";

export function CartTrigger() {
  const handle = useCartPreviewHandle();
  const { numeroItems, isHydrated } = useCart();
  const productLabel = numeroItems === 1 ? "producto" : "productos";
  const label = isHydrated && numeroItems > 0 ? `Carrito, ${numeroItems} ${productLabel}` : "Carrito";

  return <Dialog.Trigger handle={handle} id="header-cart-trigger" aria-label={label} className="relative inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"><ShoppingCart className="size-5" aria-hidden="true" />{isHydrated && numeroItems > 0 ? <span className="absolute right-0 top-0 inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[11px] font-bold leading-5 text-primary-foreground">{numeroItems > 99 ? "99+" : numeroItems}</span> : null}</Dialog.Trigger>;
}
