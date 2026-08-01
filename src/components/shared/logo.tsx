import Link from "next/link";

import { BRAND } from "@/config/brand";
import { ROUTES } from "@/config/routes";

export function Logo({ className }: { className?: string }) {
  return (
    <Link href={ROUTES.home} className={className} aria-label={`Ir al inicio de ${BRAND.name}`}>
      <span className="text-base font-semibold tracking-[0.18em] text-foreground sm:text-lg">{BRAND.shortName}</span>
    </Link>
  );
}
