import Link from "next/link";
import { Tags } from "lucide-react";

import { Container } from "@/components/layout/container";
import { Logo } from "@/components/shared/logo";
import { ROUTES } from "@/config/routes";

export function CustomerHeader() {
  return (
    <header className="border-b border-border bg-background">
      <Container className="flex min-h-16 items-center justify-between gap-4">
        <Logo className="rounded-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50" />
        <Link href={ROUTES.catalog} className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50">
          <Tags className="size-4" aria-hidden="true" />
          Catálogo
        </Link>
      </Container>
    </header>
  );
}
