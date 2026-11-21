import type { PedidoEntregaAdmin } from "@/lib/admin/pedidos";
import { formatearCantidadPreparacionEntrega } from "@/lib/delivery-preparation-quantity";
import { formatearFechaCalendario } from "@/lib/operational-date";
import { ConstanciasRecepcionDialog } from "./constancias-recepcion-dialog";

export function ConstanciasRecepcion({ fecha, pedidos }: { fecha: string; pedidos: readonly PedidoEntregaAdmin[] }) {
  const fechaProgramada = formatearFechaCalendario(fecha, { dateStyle: "long" });
  return <ConstanciasRecepcionDialog fecha={fecha} fechaProgramada={fechaProgramada} pedidos={pedidos.map(pedido => ({
    id: pedido.id,
    numero: pedido.numeroPedido,
    destinatario: pedido.destinatarioEntrega?.trim() || pedido.nombreClienteSnapshot,
    direccion: pedido.direccionEntregaSnapshot || pedido.nombreUbicacionSnapshot || "Sin dirección registrada",
    productos: pedido.items.map(item => {
      const preparada = item.confirmadoExplicito ? item.cantidadPreparada : null;
      return {
        nombre: item.nombreProducto,
        presentacion: item.nombrePresentacion,
        cantidad: formatearCantidadPreparacionEntrega(preparada ?? item.cantidad, item.nombrePresentacion, item.unidad, item.modoCantidadSnapshot),
        fuente: preparada === null ? "Pedido original" : "Preparación confirmada",
      };
    }),
  }))} />;
}
