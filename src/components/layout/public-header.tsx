import { AccountTrigger } from "@/components/navigation/account-trigger";
import { CartTrigger } from "@/components/navigation/cart-trigger";
import { MainNavigation } from "@/components/navigation/main-navigation";
import { MobileNavigation } from "@/components/navigation/mobile-navigation";
import { Container } from "@/components/layout/container";
import { Logo } from "@/components/shared/logo";
import { PUBLIC_ACCOUNT_NAVIGATION, PUBLIC_NAVIGATION } from "@/mocks/navigation";

export function PublicHeader() {
  const mobileItems = [...PUBLIC_NAVIGATION, ...PUBLIC_ACCOUNT_NAVIGATION];

  return (
    <header className="border-b border-border bg-background">
      <Container className="flex min-h-[4.5rem] items-center gap-2">
        <Logo wordmark="HIDROPONÍA" className="shrink-0 rounded-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50" />
        <MainNavigation />
        <div className="ml-auto flex items-center gap-1">
          <AccountTrigger />
          <CartTrigger />
          <MobileNavigation items={mobileItems} label="Navegación principal" title="Navegación" className="md:hidden" />
        </div>
      </Container>
    </header>
  );
}
