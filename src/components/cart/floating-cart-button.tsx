"use client";

import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { usePathname } from "next/navigation";

import { useCart } from "@/components/cart/cart-provider";
import { ROUTES } from "@/config/routes";

export function FloatingCartButton() {
  const pathname = usePathname();
  const { isHydrated, numeroItems } = useCart();

  if (!isHydrated || numeroItems === 0 || pathname === ROUTES.cart || pathname === ROUTES.checkout) return null;

  const productLabel = numeroItems === 1 ? "producto" : "productos";

  return (
    <Link
      href={ROUTES.cart}
      aria-label={`Ver carrito, ${numeroItems} ${productLabel}`}
      className="fixed right-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-40 inline-flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg outline-none transition-transform hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50 active:translate-y-px"
    >
      <ShoppingCart className="size-5" aria-hidden="true" />
      <span className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-foreground px-1 text-[11px] font-bold leading-5 text-background">{numeroItems > 99 ? "99+" : numeroItems}</span>
    </Link>
  );
}
