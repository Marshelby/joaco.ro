import type { LucideIcon } from "lucide-react";
import { useId, type ReactNode } from "react";
import { CircleAlert } from "lucide-react";

type ErrorStateProps = {
  title: string;
  description: string;
  icon?: LucideIcon;
  action?: ReactNode;
  headingLevel?: "h1" | "h2";
};

export function ErrorState({ title, description, icon: Icon = CircleAlert, action, headingLevel = "h2" }: ErrorStateProps) {
  const Heading = headingLevel;
  const titleId = useId();

  return (
    <section className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 sm:p-8" role="alert" aria-labelledby={titleId}>
      <Icon aria-hidden="true" className="size-6 text-destructive" />
      <Heading id={titleId} className="mt-4 text-xl font-semibold tracking-tight text-foreground">{title}</Heading>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </section>
  );
}
