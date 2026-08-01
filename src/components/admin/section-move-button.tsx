import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

type SectionMoveButtonProps = {
  icon: LucideIcon;
  label: string;
};

export function SectionMoveButton({ icon: Icon, label }: SectionMoveButtonProps) {
  return (
    <Button type="button" variant="outline" className="size-11 p-0" aria-label={label}>
      <Icon aria-hidden="true" />
    </Button>
  );
}
