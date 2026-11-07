import { MessageCircle } from "lucide-react";

import { ActionLink } from "@/components/ui/action-link";
import { ROUTES } from "@/config/routes";
import { obtenerResumenChatAdmin } from "@/lib/admin/mensajes";

export async function CustomerMessagesAccess() {
  const { mensajesNoLeidos } = await obtenerResumenChatAdmin();

  return (
    <ActionLink href={ROUTES.adminMessages} variant="secondary" className="gap-2">
      <MessageCircle aria-hidden="true" className="size-4" />
      Mensajes
      {mensajesNoLeidos > 0 ? <span aria-label={`${mensajesNoLeidos} mensajes sin leer`} className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">{mensajesNoLeidos}</span> : null}
    </ActionLink>
  );
}
