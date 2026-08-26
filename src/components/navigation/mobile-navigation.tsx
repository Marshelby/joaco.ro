"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Menu, X } from "lucide-react";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { NavigationIcon } from "@/components/navigation/icon";
import { NavigationLink } from "@/components/navigation/navigation-link";
import { cn } from "@/lib/utils";
import type { NavigationItem } from "@/types/navigation";

type MobileNavigationProps = {
  items: readonly NavigationItem[];
  label: string;
  title: string;
  authenticated?: boolean;
  className?: string;
};

export function MobileNavigation({ items, label, title, authenticated = false, className }: MobileNavigationProps) {
  return (
    <Dialog.Root>
      <Dialog.Trigger className={cn("inline-flex size-11 items-center justify-center rounded-lg border border-border bg-background text-foreground outline-none transition-[background-color,transform] duration-[var(--motion-fast)] ease-[var(--motion-ease-standard)] hover:bg-muted active:translate-y-px focus-visible:ring-3 focus-visible:ring-ring/50", className)} aria-label={label}>
        <Menu className="size-5" aria-hidden="true" />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-foreground/25 backdrop-blur-[1px] transition-opacity duration-[var(--motion-fast)] ease-[var(--motion-ease-standard)] motion-reduce:transition-none data-[ending-style]:opacity-0" />
        <Dialog.Viewport className="fixed inset-0 z-50 flex max-w-full justify-end overflow-x-hidden">
          <Dialog.Popup className="box-border flex h-dvh w-[min(86vw,360px)] max-w-full min-w-0 shrink-0 flex-col overflow-x-hidden border border-border bg-background pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] shadow-xl outline-none transition-transform duration-[var(--motion-fast)] ease-[var(--motion-ease-standard)] motion-reduce:transition-none data-[ending-style]:translate-x-full">
            <div className="flex min-w-0 items-center justify-between border-b border-border px-4 py-3">
              <Dialog.Title className="min-w-0 truncate text-sm font-semibold text-foreground">{title}</Dialog.Title>
              <Dialog.Close className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-foreground outline-none transition-[background-color,transform] duration-[var(--motion-fast)] ease-[var(--motion-ease-standard)] hover:bg-muted active:translate-y-px focus-visible:ring-3 focus-visible:ring-ring/50" aria-label="Cerrar menú">
                <X className="size-5" aria-hidden="true" />
              </Dialog.Close>
            </div>
            <nav className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto p-3" aria-label={label}>
              <ul className="max-w-full min-w-0 space-y-1">
                {items.map((item) => (
                  <li key={item.href} className="max-w-full min-w-0">
                    <Dialog.Close nativeButton={false} render={<NavigationLink href={item.href} exact={item.href === "/"} />} className="box-border flex min-h-11 w-full max-w-full min-w-0 items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium text-muted-foreground outline-none transition-[background-color,color,transform] duration-[var(--motion-fast)] ease-[var(--motion-ease-standard)] hover:bg-muted hover:text-foreground active:translate-y-px focus-visible:ring-3 focus-visible:ring-ring/50 data-[active=true]:bg-muted data-[active=true]:text-foreground">
                      <NavigationIcon name={item.icon} className="size-4 shrink-0" />
                      <span className="min-w-0 flex-1"><span className="block truncate">{item.label}</span>{item.description ? <span className="mt-0.5 block truncate text-xs font-normal text-muted-foreground">{item.description}</span> : null}</span>
                    </Dialog.Close>
                  </li>
                ))}
              </ul>
              {authenticated ? <div className="mt-4 border-t border-border pt-3"><SignOutButton className="w-full max-w-full" /></div> : null}
            </nav>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
