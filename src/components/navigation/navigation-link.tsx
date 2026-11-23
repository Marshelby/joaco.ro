"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentProps } from "react";

import { ROUTES } from "@/config/routes";
import { cn } from "@/lib/utils";
import { ADMIN_NAVIGATION_GROUPS, matchesAdminTab, matchesNavigationPath } from "@/mocks/navigation";
import { usePublicNavigationFeedback } from "@/components/navigation/public-navigation-feedback";

type NavigationLinkProps = ComponentProps<typeof Link> & {
  exact?: boolean;
  activeClassName?: string;
};

export function NavigationLink({ className, activeClassName, exact = false, href, onClick, ...props }: NavigationLinkProps) {
  const pathname = usePathname();
  const feedback = usePublicNavigationFeedback();
  const target = typeof href === "string" ? href : href.pathname ?? "";
  const managerTab = target === ROUTES.adminPublicManager
    ? ([
      [ROUTES.adminProducts, "productos"],
      [ROUTES.adminCategories, "categorias"],
      [ROUTES.adminHomeSections, "secciones-inicio"],
    ] as const).find(([route]) => matchesNavigationPath(pathname, route))?.[1]
    : undefined;
  const group = ADMIN_NAVIGATION_GROUPS.find(({ tabs }) => tabs[0].href === target);
  const inGroup = group?.tabs.some((tab) => matchesAdminTab(pathname, tab));
  const inOrders = target === ROUTES.adminOrders && [ROUTES.adminPossibleOrders, ROUTES.adminConstancias]
    .some((route) => matchesNavigationPath(pathname, route));
  const active = exact ? pathname === target : matchesNavigationPath(pathname, target) || inGroup || inOrders;

  return (
    <Link
      href={managerTab ? ROUTES.adminPublicManagerTab(managerTab) : href}
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
