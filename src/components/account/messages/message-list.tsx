import { claveDiaMensaje, formatDiaMensaje } from "@/lib/chat-formatters";
import type { MensajeConversacion } from "@/types/chat";

import { MessageBubble } from "./message-bubble";

export function MessageList({ mensajes, tipoPropio = "cliente", hrefPedido }: { mensajes: readonly MensajeConversacion[]; tipoPropio?: "cliente" | "admin"; hrefPedido?: (id: string) => string }) {
  return (
    <ol aria-label="Historial de mensajes" className="space-y-3">
      {mensajes.map((mensaje, indice) => {
        const dia = claveDiaMensaje(mensaje.fechaCreacion);
        const mensajeAnterior = mensajes[indice - 1];
        const mostrarSeparador = !mensajeAnterior || dia !== claveDiaMensaje(mensajeAnterior.fechaCreacion);
        return <Fragment key={mensaje.id}>
          {mostrarSeparador ? <li className="flex justify-center py-2"><span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">{formatDiaMensaje(mensaje.fechaCreacion)}</span></li> : null}
          <MessageBubble mensaje={mensaje} tipoPropio={tipoPropio} hrefPedido={hrefPedido} />
        </Fragment>;
      })}
    </ol>
  );
}
import { Fragment } from "react";
