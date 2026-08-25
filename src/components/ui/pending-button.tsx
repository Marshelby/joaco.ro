import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { LoaderCircle } from "lucide-react";
import type { ReactNode } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import type { VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

type PendingButtonProps = ButtonPrimitive.Props & VariantProps<typeof buttonVariants> & {
  pending?: boolean;
  pendingLabel?: ReactNode;
};

function PendingButton({ children, className, disabled, pending = false, pendingLabel, ...props }: PendingButtonProps) {
  return (
    <Button aria-busy={pending || undefined} className={cn("relative", className)} disabled={disabled || pending} {...props}>
      <span className={pending ? "invisible" : undefined}>{children}</span>
      {pending ? <span className="absolute inset-0 flex items-center justify-center gap-2"><LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />{pendingLabel ?? children}</span> : null}
    </Button>
  );
}

export { PendingButton };
