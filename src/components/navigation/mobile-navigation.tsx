"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Menu, X } from "lucide-react";

import { NavigationIcon } from "@/components/navigation/icon";
import { NavigationLink } from "@/components/navigation/navigation-link";
import { cn } from "@/lib/utils";
import type { NavigationItem } from "@/types/navigation";

type MobileNavigationProps = {
  items: readonly NavigationItem[];
  label: string;
  title: string;
  className?: string;
};

export function MobileNavigation({ items, label, title, className }: MobileNavigationProps) {
  return (
    <Dialog.Root>
      <Dialog.Trigger className={cn("inline-flex size-11 items-center justify-center rounded-lg border border-border bg-background text-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50", className)} aria-label={label}>
        <Menu className="size-5" aria-hidden="true" />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-foreground/25 backdrop-blur-[1px] transition-opacity duration-150 motion-reduce:transition-none data-[ending-style]:opacity-0" />
        <Dialog.Viewport className="fixed inset-0 z-50 flex justify-end">
          <Dialog.Popup className="flex h-dvh w-[86vw] max-w-[360px] shrink-0 flex-col overflow-x-hidden border border-border bg-background pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] shadow-xl outline-none transition-transform duration-150 motion-reduce:transition-none data-[ending-style]:translate-x-full">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <Dialog.Title className="text-sm font-semibold text-foreground">{title}</Dialog.Title>
              <Dialog.Close className="inline-flex size-11 items-center justify-center rounded-lg text-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50" aria-label="Cerrar menú">
                <X className="size-5" aria-hidden="true" />
              </Dialog.Close>
            </div>
            <nav className="flex-1 overflow-y-auto p-3" aria-label={label}>
              <ul className="space-y-1">
                {items.map((item) => (
                  <li key={item.href}>
                    <Dialog.Close nativeButton={false} render={<NavigationLink href={item.href} exact={item.href === "/"} />} className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 data-[active=true]:bg-muted data-[active=true]:text-foreground">
                      <NavigationIcon name={item.icon} className="size-4" />
                      <span className="min-w-0"><span className="block truncate">{item.label}</span>{item.description ? <span className="mt-0.5 block truncate text-xs font-normal text-muted-foreground">{item.description}</span> : null}</span>
                    </Dialog.Close>
                  </li>
                ))}
              </ul>
            </nav>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
