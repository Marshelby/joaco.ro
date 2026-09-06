import type { Metadata } from "next";

import { CustomerChat } from "@/components/account/messages/customer-chat";
import { EmptyState } from "@/components/feedback/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { obtenerMensajesCuenta } from "@/lib/account/mensajes";

export const metadata: Metadata = { title: "Mensajes" };

export default async function CustomerMessagesPage() {
  const datos = await obtenerMensajesCuenta();

  return (
    <div className="space-y-6">
      <PageHeader title="Mensajes" description="Habla directamente con Hidro Leufú." />
      {!datos ? <EmptyState title="No tienes una cuenta de cliente activa" description="No podemos mostrar mensajes para esta cuenta." /> : <CustomerChat conversacionInicial={datos.conversacion} mensajesIniciales={datos.mensajes} tieneMensajesAnterioresInicial={datos.tieneMensajesAnteriores} />}
    </div>
  );
}
