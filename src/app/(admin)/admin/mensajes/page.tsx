import type { Metadata } from "next";
import Link from "next/link";

import { AdminChat } from "@/components/admin/messages/admin-chat";
import { AdminInboxList } from "@/components/admin/messages/admin-inbox-list";
import { AdminInboxRealtime } from "@/components/admin/messages/admin-inbox-realtime";
import { EmptyState } from "@/components/feedback/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/config/routes";
import { obtenerDetalleChatAdmin, obtenerInboxChatAdmin } from "@/lib/admin/mensajes";

export const metadata: Metadata = { title: "Mensajes" };

function texto(value: string | string[] | undefined) { return typeof value === "string" ? value : undefined; }

export default async function AdminMessagesPage({ searchParams }: { searchParams: Promise<{ filtro?: string | string[]; cliente?: string | string[]; cursorFecha?: string | string[]; cursorId?: string | string[] }> }) {
  const query = await searchParams;
  const soloNoLeidos = texto(query.filtro) === "no-leidos";
  const cursorFecha = texto(query.cursorFecha);
  const cursorId = texto(query.cursorId);
  const clienteId = texto(query.cliente);
  const inbox = await obtenerInboxChatAdmin({ soloNoLeidos, cursor: cursorFecha && cursorId ? { ultimoMensajeEn: cursorFecha, conversacionId: cursorId } : undefined });
  const detalle = clienteId ? await obtenerDetalleChatAdmin(clienteId) : null;
  const hrefFiltro = (filtro: string | null) => filtro ? `${ROUTES.adminMessages}?filtro=${filtro}` : ROUTES.adminMessages;
  const hrefClienteDesktop = (id: string) => `${ROUTES.adminMessages}?cliente=${id}${soloNoLeidos ? "&filtro=no-leidos" : ""}`;
  const hrefSiguiente = inbox.siguienteCursor ? `${ROUTES.adminMessages}?${new URLSearchParams({ ...(soloNoLeidos ? { filtro: "no-leidos" } : {}), cursorFecha: inbox.siguienteCursor.ultimoMensajeEn, cursorId: inbox.siguienteCursor.conversacionId }).toString()}` : null;

  return <AdminInboxRealtime><div className="space-y-6"><PageHeader title="Mensajes" description="Conversaciones entre clientes y Hidro Leufú." actions={<div className="flex rounded-lg border border-border p-1"><Button render={<Link href={hrefFiltro(null)} />} size="sm" variant={soloNoLeidos ? "ghost" : "secondary"}>Todos</Button><Button render={<Link href={hrefFiltro("no-leidos")} />} size="sm" variant={soloNoLeidos ? "secondary" : "ghost"}>No leídos</Button></div>} />
    {inbox.conversaciones.length === 0 ? <EmptyState title={soloNoLeidos ? "No tienes mensajes pendientes" : "Aún no hay conversaciones"} description={soloNoLeidos ? "Las conversaciones con mensajes pendientes aparecerán aquí." : "Puedes iniciar una conversación desde la ficha de un cliente."} /> : <><div className="lg:hidden rounded-xl border border-border bg-card"><AdminInboxList conversaciones={inbox.conversaciones} hrefFor={ROUTES.adminCustomerMessages} /></div><div className="hidden min-h-[38rem] overflow-hidden rounded-xl border border-border bg-card lg:grid lg:grid-cols-[22rem_minmax(0,1fr)]"><aside className="overflow-y-auto border-r border-border"><AdminInboxList conversaciones={inbox.conversaciones} hrefFor={hrefClienteDesktop} /></aside><div className="min-w-0 bg-muted/15 p-4 xl:p-5">{detalle ? <AdminChat cliente={detalle.cliente} conversacionInicial={detalle.conversacion} mensajesIniciales={detalle.mensajes} tieneMensajesAnterioresInicial={detalle.tieneMensajesAnteriores} /> : <div className="flex h-full min-h-80 items-center justify-center text-center"><div className="max-w-sm"><h2 className="font-semibold text-foreground">Selecciona una conversación</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Elige un cliente del inbox para revisar o responder sus mensajes.</p></div></div>}</div></div>{hrefSiguiente ? <div className="flex justify-center"><Button render={<Link href={hrefSiguiente} />} variant="outline">Cargar más conversaciones</Button></div> : null}</>}
  </div></AdminInboxRealtime>;
}
