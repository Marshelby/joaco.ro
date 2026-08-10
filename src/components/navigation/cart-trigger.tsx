"use client";

import { ShoppingCart } from "lucide-react";

import { useCart } from "@/components/cart/cart-provider";
import { NavigationLink } from "@/components/navigation/navigation-link";
import { ROUTES } from "@/config/routes";

export function CartTrigger() {
  const { cantidadTotal, isHydrated } = useCart();
  const label = isHydrated && cantidadTotal > 0 ? `Carrito, ${cantidadTotal} productos` : "Carrito";

  return <NavigationLink href={ROUTES.cart} aria-label={label} className="relative inline-flex size-11 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50" activeClassName="bg-muted text-foreground"><ShoppingCart className="size-5" aria-hidden="true" />{isHydrated && cantidadTotal > 0 ? <span className="absolute right-0 top-0 inline-flex min-w-5 translate-x-1/4 -translate-y-1/4 items-center justify-center rounded-full bg-primary px-1 text-[11px] font-bold leading-5 text-primary-foreground">{cantidadTotal > 99 ? "99+" : cantidadTotal}</span> : null}</NavigationLink>;
}
