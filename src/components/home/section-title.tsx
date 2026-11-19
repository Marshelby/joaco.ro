import { HOME_SECTION_ICONS, type HomeSectionIcon } from "@/lib/home-section-icons";

type SectionTitleProps = { eyebrow?: string; title: string; description?: string; icon?: HomeSectionIcon };

export function SectionTitle({ eyebrow, title, description, icon }: SectionTitleProps) {
  const Icon = icon ? HOME_SECTION_ICONS[icon].Icon : null;

  return (
    <div className="max-w-2xl">
      {eyebrow && <p className="text-sm font-semibold tracking-wide text-accent">{eyebrow}</p>}
      <h2 className="mt-2 flex items-start gap-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
        {Icon && <Icon aria-hidden="true" className="mt-1 size-6 shrink-0 text-accent sm:size-7" />}
        <span className="min-w-0 break-words">{title}</span>
      </h2>
      {description && <p className="mt-3 break-words text-sm leading-6 text-muted-foreground sm:text-base">{description}</p>}
    </div>
  );
}
