import { BRAND } from "@/config/brand";
import { ROUTES } from "@/config/routes";
import { PublicLink } from "@/components/navigation/public-navigation-feedback";

export function Logo({ className, wordmark = BRAND.shortName }: { className?: string; wordmark?: string }) {
  return (
    <PublicLink href={ROUTES.home} className={`inline-flex transition-[opacity,transform] duration-[var(--motion-fast)] ease-[var(--motion-ease-standard)] hover:opacity-80 active:translate-y-px ${className ?? ""}`} aria-label={`Ir al inicio de ${BRAND.name}`}>
      <span className="text-base font-semibold tracking-[0.18em] text-foreground sm:text-lg">{wordmark}</span>
    </PublicLink>
  );
}
