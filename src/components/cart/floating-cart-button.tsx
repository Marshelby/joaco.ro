"use client";

import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { usePathname } from "next/navigation";

import { useCart } from "@/components/cart/cart-provider";
import { ROUTES } from "@/config/routes";
import { formatCLP } from "@/lib/formatters";

export function FloatingCartButton() {
  const pathname = usePathname();
  const { isHydrated, numeroItems, totalEstimado } = useCart();

  if (!isHydrated || numeroItems === 0 || pathname === ROUTES.cart || pathname === ROUTES.checkout) return null;

  const productLabel = numeroItems === 1 ? "producto" : "productos";

  return (
    <Link
      href={ROUTES.cart}
      aria-label={`Ver carrito, ${numeroItems} ${productLabel}, total estimado ${formatCLP(totalEstimado)}`}
      className="box-border fixed right-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-40 inline-flex min-h-11 max-w-[calc(100vw-2rem)] min-w-0 items-center gap-2 overflow-hidden rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-lg outline-none transition-transform hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50 active:translate-y-px"
    >
      <ShoppingCart className="size-5 shrink-0" aria-hidden="true" />
      <span className="shrink-0">{numeroItems > 99 ? "99+" : numeroItems}</span>
      <span className="shrink-0" aria-hidden="true">·</span>
      <span className="min-w-0 truncate">{formatCLP(totalEstimado)}</span>
    </Link>
  );
}
