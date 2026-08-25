import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return <div {...props} aria-hidden="true" className={cn("motion-skeleton rounded-md", className)} />;
}

export { Skeleton };
