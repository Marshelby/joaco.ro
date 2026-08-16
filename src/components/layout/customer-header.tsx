import Link from "next/link";
import { Tags } from "lucide-react";

import { Container } from "@/components/layout/container";
import { Logo } from "@/components/shared/logo";
import { ROUTES } from "@/config/routes";

export function CustomerHeader() {
  return (
    <header className="border-b border-border bg-background">
      <Container className="flex min-h-16 items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <Logo className="shrink-0 rounded-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50" />
          <Link href={ROUTES.home} className="hidden min-h-11 items-center text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 md:inline-flex">
            Ir a Hidro Leufú →
          </Link>
        </div>
        <Link href={ROUTES.catalog} className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50">
          <Tags className="size-4" aria-hidden="true" />
          Catálogo
        </Link>
      </Container>
    </header>
  );
}
