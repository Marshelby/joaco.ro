import type { ReactNode } from "react";

import { Container } from "@/components/layout/container";
import { CustomerHeader } from "@/components/layout/customer-header";
import { AccountNavigation } from "@/components/navigation/account-navigation";
import { obtenerCuentaDashboard } from "@/lib/account/account-dashboard";
import { hrefConReturnTo } from "@/lib/account/return-to";
import { ROUTES } from "@/config/routes";
import { redirect } from "next/navigation";

export default async function CustomerLayout({ children }: Readonly<{ children: ReactNode }>) {
  const cuenta = await obtenerCuentaDashboard();
  if (cuenta.estado === "guest") redirect(hrefConReturnTo("/iniciar-sesion", ROUTES.account));
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <CustomerHeader />
      <Container className="flex-1 py-6 sm:py-10">
        <div className="space-y-8">
          {cuenta.estado === "active_customer" ? <aside className="border-b border-border pb-4"><AccountNavigation /></aside> : null}
          <main id="main-content" tabIndex={-1} className="min-w-0 outline-none">{children}</main>
        </div>
      </Container>
    </div>
  );
}
