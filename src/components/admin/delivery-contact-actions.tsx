import { MessageCircle, Phone } from "lucide-react";

import { crearEnlaceWhatsapp, crearMensajeEntrega } from "@/lib/whatsapp";

type DeliveryContactActionsProps = {
  telefono: string | null | undefined;
  numeroPedido: string;
  estado: string;
  nombreEmisor?: string | null;
};

export function DeliveryContactActions({ telefono, numeroPedido, estado, nombreEmisor }: DeliveryContactActionsProps) {
  if (!telefono) return null;

  const enlaceWhatsapp = crearEnlaceWhatsapp(telefono, crearMensajeEntrega({ numeroPedido, estado, nombreEmisor }));

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <a href={`tel:${telefono}`} className="inline-flex min-h-11 items-center gap-2 text-primary underline underline-offset-4" aria-label={`Llamar al cliente al ${telefono}`}>
        <Phone className="size-4 shrink-0" aria-hidden="true" />
        {telefono}
      </a>
      {enlaceWhatsapp ? (
        <a href={enlaceWhatsapp} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-primary outline-none transition-colors hover:bg-muted hover:text-primary/75 focus-visible:ring-3 focus-visible:ring-ring/50" aria-label={`Escribir por WhatsApp al cliente al ${telefono}`}>
          <MessageCircle className="size-4 shrink-0" aria-hidden="true" />
          WhatsApp
        </a>
      ) : null}
    </div>
  );
}
