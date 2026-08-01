import Link from "next/link";

import { Container } from "@/components/layout/container";
import { Logo } from "@/components/shared/logo";
import { PUBLIC_ACCOUNT_NAVIGATION, PUBLIC_NAVIGATION } from "@/mocks/navigation";

export function PublicFooter() {
  return (
    <footer className="mt-auto border-t border-border bg-secondary/55">
      <Container className="py-10 sm:py-12">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.35fr)_minmax(10rem,0.75fr)_minmax(14rem,1fr)] lg:gap-12">
          <div className="max-w-md space-y-3">
            <Logo className="inline-block rounded-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50" />
            <p className="text-sm leading-6 text-muted-foreground">Productos útiles para el hogar y el día a día.</p>
          </div>
          <nav aria-label="Explorar JOACO RO">
            <h2 className="text-sm font-semibold text-foreground">Explorar</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {[...PUBLIC_NAVIGATION, ...PUBLIC_ACCOUNT_NAVIGATION].map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="rounded-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">{item.label}</Link>
                </li>
              ))}
            </ul>
          </nav>
          <section aria-labelledby="footer-purchase-title">
            <h2 id="footer-purchase-title" className="text-sm font-semibold text-foreground">Compra con claridad</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">Revisamos la disponibilidad antes de confirmar tu pedido. Luego coordinamos el pago y la entrega o el retiro.</p>
          </section>
        </div>
        <div className="mt-9 grid gap-3 border-t border-border pt-6 text-sm text-muted-foreground sm:grid-cols-3">
          <p>Disponibilidad confirmada antes de pagar.</p>
          <p>Pedido revisado por JOACO RO.</p>
          <p>Entrega o retiro coordinado.</p>
        </div>
      </Container>
    </footer>
  );
}
