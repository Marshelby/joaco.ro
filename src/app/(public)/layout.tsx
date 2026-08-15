import type { ReactNode } from "react";

import { FloatingCartButton } from "@/components/cart/floating-cart-button";
import { PublicFooter } from "@/components/layout/public-footer";
import { PublicHeader } from "@/components/layout/public-header";
import { PublicIdentityProvider } from "@/components/layout/public-identity-provider";
import { obtenerIdentidadActual } from "@/lib/account/identity";

export default async function PublicLayout({ children }: Readonly<{ children: ReactNode }>) {
  const identidad = await obtenerIdentidadActual();
  return (
    <PublicIdentityProvider identidad={identidad}><div className="flex min-h-full w-full min-w-0 max-w-full flex-1 flex-col overflow-x-hidden">
      <PublicHeader identidad={identidad} />
      <main id="main-content" tabIndex={-1} className="min-w-0 max-w-full flex-1 outline-none">{children}</main>
      <PublicFooter tieneSesion={Boolean(identidad)} />
      <FloatingCartButton />
    </div></PublicIdentityProvider>
  );
}
