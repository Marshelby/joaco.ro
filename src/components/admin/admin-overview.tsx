import { Clock3, FolderTree, LayoutPanelTop, Package } from "lucide-react";

import { ADMIN_OVERVIEW_MOCK } from "@/mocks/admin";

const overviewIcons = [Package, FolderTree, LayoutPanelTop, Clock3] as const;

export function AdminOverview() {
  return (
    <section aria-labelledby="admin-overview-title">
      <div className="max-w-2xl">
        <h2 id="admin-overview-title" className="text-2xl font-semibold tracking-tight text-foreground">Vista general</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground sm:text-base">Una referencia clara del contenido que sostiene la experiencia de JOACO RO.</p>
      </div>
      <dl className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {ADMIN_OVERVIEW_MOCK.map((item, index) => {
          const Icon = overviewIcons[index];

          return (
            <div key={item.label} className="rounded-xl border border-border bg-card p-5 sm:p-6">
              <dt className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Icon className="size-4 text-accent" aria-hidden="true" />
                {item.label}
              </dt>
              <dd className="mt-5 text-xl font-semibold tracking-tight text-foreground">{item.value}</dd>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description}</p>
            </div>
          );
        })}
      </dl>
    </section>
  );
}
