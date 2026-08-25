import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

function FadeIn({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("motion-fade-in", className)} {...props} />;
}

export { FadeIn };
