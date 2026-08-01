import { cva, type VariantProps } from "class-variance-authority";
import Link from "next/link";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

const actionLinkVariants = cva(
  "inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-semibold outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground hover:bg-primary/90",
        secondary: "border border-border bg-background text-foreground hover:bg-muted",
        quiet: "px-3 text-primary hover:bg-muted hover:text-primary/75",
      },
    },
    defaultVariants: { variant: "primary" },
  },
);

type ActionLinkProps = ComponentProps<typeof Link> & VariantProps<typeof actionLinkVariants>;

function ActionLink({ className, variant, ...props }: ActionLinkProps) {
  return <Link className={cn(actionLinkVariants({ variant }), className)} {...props} />;
}

export { ActionLink, actionLinkVariants };
