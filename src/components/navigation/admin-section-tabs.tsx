"use client";

import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";

import { ROUTES } from "@/config/routes";
import { ADMIN_NAVIGATION_GROUPS, matchesAdminTab } from "@/mocks/navigation";

export function AdminSectionTabs() {
  const segment = useSelectedLayoutSegment();
  const pathname = `${ROUTES.admin}/${segment ?? ""}`;
  const group = ADMIN_NAVIGATION_GROUPS.find(({ tabs }) => tabs.some((tab) => matchesAdminTab(pathname, tab)));

  if (!group) return null;

  return (
    <nav aria-label={group.label} className="flex flex-wrap gap-1 rounded-xl border border-border bg-card p-1">
      {group.tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          prefetch={false}
          aria-current={matchesAdminTab(pathname, tab) ? "page" : undefined}
          className="inline-flex min-h-11 flex-1 items-center justify-center rounded-lg px-3 py-2 text-center text-sm font-semibold text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground sm:flex-none sm:px-4"
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
