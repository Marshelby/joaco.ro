import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AdminChat } from "@/components/admin/messages/admin-chat";
import { PageHeader } from "@/components/shared/page-header";
import { ActionLink } from "@/components/ui/action-link";
import { ROUTES } from "@/config/routes";
import { obtenerDetalleChatAdmin } from "@/lib/admin/mensajes";

export const metadata: Metadata = { title: "Conversación" };

export default async function AdminMessageDetailPage({ params }: { params: Promise<{ clienteId: string }> }) {
  const { clienteId } = await params;
  const detalle = await obtenerDetalleChatAdmin(clienteId);
  if (!detalle) notFound();
  return <div className="space-y-6"><PageHeader title="Mensajes" description="Conversación con cliente." actions={<ActionLink href={ROUTES.adminMessages} variant="secondary">Volver a mensajes</ActionLink>} /><AdminChat cliente={detalle.cliente} conversacionInicial={detalle.conversacion} mensajesIniciales={detalle.mensajes} tieneMensajesAnterioresInicial={detalle.tieneMensajesAnteriores} /></div>;
}
