"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentProps } from "react";

import { ROUTES } from "@/config/routes";
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
  const managerTab = target === ROUTES.adminPublicManager
    ? ([
      [ROUTES.adminProducts, "productos"],
      [ROUTES.adminCategories, "categorias"],
      [ROUTES.adminHomeSections, "secciones-inicio"],
    ] as const).find(([route]) => pathname === route || pathname.startsWith(`${route}/`))?.[1]
    : undefined;
  const groupedPathname = managerTab
    ? target
    : target === "/admin/clientes" && (pathname === "/admin/mensajes" || pathname.startsWith("/admin/mensajes/"))
      ? target
      : pathname;
  const activePathname = target === "/admin/pedidos" && (pathname === "/admin/posibles-pedidos" || pathname.startsWith("/admin/posibles-pedidos/"))
    ? pathname.replace("/admin/posibles-pedidos", "/admin/pedidos")
    : groupedPathname;
  const active = exact ? activePathname === target : activePathname === target || activePathname.startsWith(`${target}/`);

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
