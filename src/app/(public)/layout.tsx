import type { ReactNode } from "react";

import { CartProvider } from "@/components/cart/cart-provider";
import { PublicFooter } from "@/components/layout/public-footer";
import { PublicHeader } from "@/components/layout/public-header";

export default function PublicLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <CartProvider><div className="flex min-h-full flex-1 flex-col">
      <PublicHeader />
      <main id="main-content" tabIndex={-1} className="flex-1 outline-none">{children}</main>
      <PublicFooter />
    </div></CartProvider>
  );
}
