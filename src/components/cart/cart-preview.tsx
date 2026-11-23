"use client";

import { Dialog } from "@base-ui/react/dialog";
import { ShoppingCart, X } from "lucide-react";
import { createContext, useContext, useRef, useState, type ReactNode } from "react";

import { CartLineItem } from "@/components/cart/cart-line-item";
import { useCart } from "@/components/cart/cart-provider";
import { CartSummary } from "@/components/cart/cart-summary";
import { PublicLink } from "@/components/navigation/public-navigation-feedback";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/config/routes";

const CartPreviewContext = createContext<Dialog.Handle<unknown> | null>(null);

export function useCartPreviewHandle() {
  const handle = useContext(CartPreviewContext);
  if (!handle) throw new Error("El acceso al carrito requiere CartPreview.");
  return handle;
}

export function CartPreview({ children }: { children: ReactNode }) {
  const { items, numeroItems, totalEstimado, isHydrated } = useCart();
  const [handle] = useState(() => Dialog.createHandle());
  const closeRef = useRef<HTMLButtonElement>(null);
  const productLabel = numeroItems === 1 ? "producto" : "productos";

  return (
    <CartPreviewContext.Provider value={handle}>
      {children}
      <Dialog.Root handle={handle}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-50 bg-foreground/40 transition-opacity duration-[var(--motion-fast)] ease-[var(--motion-ease-standard)] motion-reduce:transition-none data-[starting-style]:opacity-0 data-[ending-style]:opacity-0" />
          <Dialog.Viewport className="fixed inset-0 z-50 flex justify-end overflow-hidden">
            <Dialog.Popup
              initialFocus={closeRef}
              finalFocus={() => numeroItems === 0 ? document.getElementById("header-cart-trigger") ?? true : true}
              className="flex h-dvh w-[calc(100%-1rem)] max-w-[29rem] min-w-0 flex-col overflow-hidden bg-background pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] shadow-xl outline-none transition-transform duration-[var(--motion-fast)] ease-[var(--motion-ease-standard)] motion-reduce:transition-none data-[starting-style]:translate-x-full data-[ending-style]:translate-x-full sm:border-l sm:border-border"
            >
              <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
                <div>
                  <Dialog.Title className="text-xl font-semibold tracking-tight text-foreground">Tu pedido</Dialog.Title>
                  <p aria-live="polite" className="text-sm text-muted-foreground">
                    {isHydrated ? `${numeroItems} ${productLabel}` : "Cargando tu pedido…"}
                  </p>
                </div>
                <Dialog.Close ref={closeRef} render={<Button variant="ghost" size="icon" />} className="size-11" aria-label="Cerrar carrito">
                  <X className="size-5" aria-hidden="true" />
                </Dialog.Close>
              </header>

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                {isHydrated && numeroItems === 0 ? (
                  <div className="flex min-h-full flex-col items-center justify-center gap-4 p-6 text-center">
                    <ShoppingCart className="size-7 text-muted-foreground" aria-hidden="true" />
                    <p className="font-medium text-foreground">Tu carrito está vacío</p>
                    <Dialog.Close render={<Button variant="outline" />}>Continuar comprando</Dialog.Close>
                  </div>
                ) : isHydrated ? (
                  <div className="divide-y divide-border">
                    {items.map((item) => <CartLineItem key={`${item.productoId}:${item.presentacionId}`} item={item} />)}
                  </div>
                ) : null}
              </div>

              {isHydrated && numeroItems > 0 ? (
                <footer className="flex max-h-[60%] shrink-0 flex-col border-t border-border bg-card p-4 sm:p-5">
                  <div className="min-h-0 overflow-y-auto overscroll-contain">
                    <h2 className="mb-3 text-base font-semibold text-foreground">Resumen</h2>
                    <CartSummary subtotal={totalEstimado} />
                  </div>
                  <Button
                    nativeButton={false}
                    render={<PublicLink href={ROUTES.cart} onNavigate={() => handle.close()} />}
                    size="lg"
                    className="mt-4 w-full"
                  >
                    Continuar pedido
                  </Button>
                </footer>
              ) : null}
            </Dialog.Popup>
          </Dialog.Viewport>
        </Dialog.Portal>
      </Dialog.Root>
    </CartPreviewContext.Provider>
  );
}
