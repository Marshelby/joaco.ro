"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { createContext, forwardRef, useCallback, useContext, useState, type ComponentProps, type MouseEvent, type ReactNode } from "react";

import { NavigationFeedback } from "@/components/ui/navigation-feedback";

type NavigationFeedbackContextValue = {
  beginNavigation: (href: string) => void;
};

const NavigationFeedbackContext = createContext<NavigationFeedbackContextValue | null>(null);

function PublicNavigationFeedbackProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const currentHref = `${pathname}${searchParams.size > 0 ? `?${searchParams.toString()}` : ""}`;
  const beginNavigation = useCallback((href: string) => setPendingHref(href), []);
  const active = pendingHref !== null && pendingHref !== currentHref;

  return <NavigationFeedbackContext.Provider value={{ beginNavigation }}><NavigationFeedback active={active} />{children}</NavigationFeedbackContext.Provider>;
}

function usePublicNavigationFeedback() {
  return useContext(NavigationFeedbackContext);
}

type PublicLinkProps = ComponentProps<typeof Link>;

function shouldStartNavigation(event: MouseEvent<HTMLAnchorElement>) {
  return event.button === 0 && !event.defaultPrevented && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

function getNavigationTarget(href: PublicLinkProps["href"]) {
  if (typeof href === "string") return href;
  const query = href.query ? new URLSearchParams(Object.entries(href.query).flatMap(([key, value]) => Array.isArray(value) ? value.map((entry) => [key, entry]) : value === undefined ? [] : [[key, String(value)]])).toString() : "";
  return `${href.pathname ?? ""}${query ? `?${query}` : ""}${href.hash ?? ""}`;
}

const PublicLink = forwardRef<HTMLAnchorElement, PublicLinkProps>(function PublicLink({ onClick, ...props }, ref) {
  const feedback = usePublicNavigationFeedback();

  return <Link ref={ref} {...props} onClick={(event) => {
    onClick?.(event);
    if (shouldStartNavigation(event)) feedback?.beginNavigation(getNavigationTarget(props.href));
  }} />;
});

export { PublicLink, PublicNavigationFeedbackProvider, usePublicNavigationFeedback };
