type SectionTitleProps = { eyebrow?: string; title: string; description?: string };

export function SectionTitle({ eyebrow, title, description }: SectionTitleProps) {
  return <div className="max-w-2xl">{eyebrow ? <p className="text-sm font-semibold tracking-wide text-accent">{eyebrow}</p> : null}<h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{title}</h2>{description ? <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">{description}</p> : null}</div>;
}
