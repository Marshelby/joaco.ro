import Link from "next/link";

import { formatHoraMensaje } from "@/lib/chat-formatters";
import { cn } from "@/lib/utils";
import type { ConversacionInboxAdmin } from "@/types/chat";

export function AdminInboxList({ conversaciones, hrefFor }: { conversaciones: readonly ConversacionInboxAdmin[]; hrefFor: (clienteId: string) => string }) {
  return <ol aria-label="Conversaciones" className="divide-y divide-border">
    {conversaciones.map((conversacion) => {
      const noLeidos = conversacion.mensajesNoLeidos > 0;
      return <li key={conversacion.id}><Link href={hrefFor(conversacion.cliente.id)} className={cn("block p-4 outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50", noLeidos && "bg-primary/5")}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex items-center gap-2"><h2 className="truncate text-sm font-semibold text-foreground">{conversacion.cliente.nombre}</h2>{noLeidos ? <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground" aria-label={`${conversacion.mensajesNoLeidos} mensajes sin leer`}>{conversacion.mensajesNoLeidos}</span> : null}</div><p className="mt-1 line-clamp-2 text-sm leading-5 text-muted-foreground">{conversacion.ultimoMensajePreview || "Sin mensajes"}</p><p className="mt-1 text-xs text-muted-foreground">{conversacion.ultimoRemitenteTipo === "cliente" ? "Último mensaje del cliente" : "Último mensaje de Hidro Leufú"}</p></div>{conversacion.ultimoMensajeEn ? <time dateTime={conversacion.ultimoMensajeEn} className="shrink-0 text-xs text-muted-foreground">{formatHoraMensaje(conversacion.ultimoMensajeEn)}</time> : null}</div></Link></li>;
    })}
  </ol>;
}
