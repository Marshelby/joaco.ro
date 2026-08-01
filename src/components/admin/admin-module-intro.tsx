import type { LucideIcon } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";

type AdminModuleIntroProps = {
  title: string;
  description: string;
  icon: LucideIcon;
  surfaceTitle: string;
  surfaceDescription: string;
};

export function AdminModuleIntro({ title, description, icon: Icon, surfaceTitle, surfaceDescription }: AdminModuleIntroProps) {
  return (
    <div className="space-y-8">
      <PageHeader title={title} description={description} />
      <section className="rounded-xl border border-border bg-card p-6 sm:p-8" aria-labelledby="admin-module-title">
        <Icon className="size-6 text-accent" aria-hidden="true" />
        <h2 id="admin-module-title" className="mt-5 text-xl font-semibold tracking-tight text-foreground">{surfaceTitle}</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{surfaceDescription}</p>
      </section>
    </div>
  );
}
