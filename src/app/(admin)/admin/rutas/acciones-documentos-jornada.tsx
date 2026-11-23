import type { PedidoEntregaAdmin } from "@/lib/admin/pedidos";
import { ConstanciasRecepcion } from "./constancias-recepcion";
import { FacturasDelDia } from "./facturas-del-dia";

export function AccionesDocumentosJornada({ fecha, pedidos }: {
  fecha: string;
  pedidos: readonly PedidoEntregaAdmin[];
}) {
  return <div className="flex flex-wrap gap-2">
    <ConstanciasRecepcion key={fecha} fecha={fecha} pedidos={pedidos} />
    <FacturasDelDia fecha={fecha} pedidos={pedidos} />
  </div>;
}
