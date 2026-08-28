import type { LucideIcon } from "lucide-react";
import { PendingButton } from "@/components/ui/pending-button";

type SectionMoveButtonProps = {
  icon: LucideIcon;
  label: string;
  direction: "arriba" | "abajo";
  disabled: boolean;
  pending: boolean;
};

export function SectionMoveButton({ icon: Icon, label, direction, disabled, pending }: SectionMoveButtonProps) {
  return (
    <PendingButton type="submit" name="direccion" value={direction} variant="outline" className="size-11 p-0" aria-label={label} disabled={disabled} pending={pending} pendingLabel={<span className="sr-only">Moviendo</span>}>
      <Icon aria-hidden="true" />
    </PendingButton>
  );
}
