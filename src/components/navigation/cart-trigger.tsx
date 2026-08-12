"use client";

import { ShoppingCart } from "lucide-react";

import { useCart } from "@/components/cart/cart-provider";
import { NavigationLink } from "@/components/navigation/navigation-link";
import { ROUTES } from "@/config/routes";

export function CartTrigger() {
  const { numeroItems, isHydrated } = useCart();
  const label = isHydrated && numeroItems > 0 ? `Carrito, ${numeroItems} productos` : "Carrito";

  return <NavigationLink href={ROUTES.cart} aria-label={label} className="relative inline-flex size-11 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50" activeClassName="bg-muted text-foreground"><ShoppingCart className="size-5" aria-hidden="true" />{isHydrated && numeroItems > 0 ? <span className="absolute right-0 top-0 inline-flex min-w-5 translate-x-1/4 -translate-y-1/4 items-center justify-center rounded-full bg-primary px-1 text-[11px] font-bold leading-5 text-primary-foreground">{numeroItems > 99 ? "99+" : numeroItems}</span> : null}</NavigationLink>;
}
