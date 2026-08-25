import { cn } from "@/lib/utils";

type NavigationFeedbackProps = {
  active: boolean;
  className?: string;
};

function NavigationFeedback({ active, className }: NavigationFeedbackProps) {
  return <div aria-hidden="true" data-active={active || undefined} className={cn("motion-navigation-feedback fixed inset-x-0 top-0 z-[100] h-0.5 bg-primary", className)} />;
}

export { NavigationFeedback };
