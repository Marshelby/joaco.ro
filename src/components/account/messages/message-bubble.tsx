import Link from "next/link";

import { formatHoraMensaje } from "@/lib/chat-formatters";
import { ROUTES } from "@/config/routes";
import type { MensajeConversacion } from "@/types/chat";

export function MessageBubble({ mensaje, tipoPropio = "cliente", hrefPedido }: { mensaje: MensajeConversacion; tipoPropio?: "cliente" | "admin"; hrefPedido?: (id: string) => string }) {
  const esPropio = mensaje.remitenteTipo === tipoPropio;
  const emisor = esPropio ? "Tú" : mensaje.remitenteNombreSnapshot || "Hidro Leufú";

  return (
    <li className={esPropio ? "flex justify-end" : "flex justify-start"}>
      <article aria-label={`Mensaje de ${emisor}`} className={esPropio ? "max-w-[88%] rounded-2xl rounded-br-md bg-primary px-3.5 py-3 text-primary-foreground sm:max-w-[75%]" : "max-w-[88%] rounded-2xl rounded-bl-md border border-border bg-card px-3.5 py-3 text-foreground sm:max-w-[75%]"}>
        {!esPropio ? <p className="mb-1 text-xs font-semibold text-primary">{emisor}</p> : null}
        <p className="whitespace-pre-wrap break-words text-sm leading-6">{mensaje.contenido}</p>
        <div className={esPropio ? "mt-2 flex flex-wrap items-center justify-end gap-x-2 gap-y-1 text-xs text-primary-foreground/75" : "mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground"}>
          {mensaje.pedido ? <Link href={hrefPedido?.(mensaje.pedido.id) ?? ROUTES.customerOrder(mensaje.pedido.id)} className={esPropio ? "font-medium underline underline-offset-2 hover:text-primary-foreground" : "font-medium text-primary underline underline-offset-2 hover:text-primary/80"}>Pedido {mensaje.pedido.numeroPedido}</Link> : null}
          <time dateTime={mensaje.fechaCreacion}>{formatHoraMensaje(mensaje.fechaCreacion)}</time>
        </div>
      </article>
    </li>
  );
}
