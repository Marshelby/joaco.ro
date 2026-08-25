"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";
import { usePublicNavigationFeedback } from "@/components/navigation/public-navigation-feedback";

type NavigationLinkProps = ComponentProps<typeof Link> & {
  exact?: boolean;
  activeClassName?: string;
};

export function NavigationLink({ className, activeClassName, exact = false, href, onClick, ...props }: NavigationLinkProps) {
  const pathname = usePathname();
  const feedback = usePublicNavigationFeedback();
  const target = typeof href === "string" ? href : href.pathname ?? "";
  const active = exact ? pathname === target : pathname === target || pathname.startsWith(`${target}/`);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      data-active={active ? "true" : undefined}
      className={cn(className, active && activeClassName)}
      onClick={(event) => {
        onClick?.(event);
        if (event.button === 0 && !event.defaultPrevented && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) feedback?.beginNavigation(target);
      }}
      {...props}
    />
  );
}
