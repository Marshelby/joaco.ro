import type { ReactNode } from "react";

import { Container } from "@/components/layout/container";
import { CustomerHeader } from "@/components/layout/customer-header";
import { AccountNavigation } from "@/components/navigation/account-navigation";

export default function CustomerLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <CustomerHeader />
      <Container className="flex-1 py-6 sm:py-10">
        <div className="space-y-8">
          <aside className="border-b border-border pb-4"><AccountNavigation /></aside>
          <main id="main-content" tabIndex={-1} className="min-w-0 outline-none">{children}</main>
        </div>
      </Container>
    </div>
  );
}
