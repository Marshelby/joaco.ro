import type { LucideIcon } from "lucide-react";
import { useId, type ReactNode } from "react";
import { Inbox } from "lucide-react";

type EmptyStateProps = {
  title: string;
  description: string;
  icon?: LucideIcon;
  action?: ReactNode;
  headingLevel?: "h1" | "h2";
};

export function EmptyState({ title, description, icon: Icon = Inbox, action, headingLevel = "h2" }: EmptyStateProps) {
  const Heading = headingLevel;
  const titleId = useId();

  return (
    <section className="rounded-xl border border-dashed border-border bg-card p-6 text-center sm:p-8" aria-labelledby={titleId}>
      <Icon aria-hidden="true" className="mx-auto size-6 text-muted-foreground" />
      <Heading id={titleId} className="mt-4 text-xl font-semibold tracking-tight text-foreground">{title}</Heading>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted-foreground">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </section>
  );
}
