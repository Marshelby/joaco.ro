import "server-only";

import type { presentarResultadoEntrega } from "@/components/admin/delivery-result";
import type { ResumenContablePedido } from "@/lib/admin/pedido-contabilidad";
import type { PedidoAdminDetalle, PedidoAdminListado } from "@/lib/admin/pedidos";
import { formatearCantidadPreparacionEntrega } from "@/lib/delivery-preparation-quantity";
import { formatDateTimeCL } from "@/lib/formatters";
import { leerInstante } from "@/lib/operational-date";

export function fechaEntregaDefinitiva(pedido: Pick<PedidoAdminListado, "estado" | "ventaReconocidaEn">) {
  const fecha = pedido.ventaReconocidaEn;
  return pedido.estado === "entregado" && fecha && Number.isFinite(leerInstante(fecha)) ? fecha : null;
}

export function prepararGuiaEntrega(
  pedido: PedidoAdminDetalle,
  resultado: ReturnType<typeof presentarResultadoEntrega>,
  contabilidad: ResumenContablePedido | null,
) {
  const fecha = fechaEntregaDefinitiva(pedido);
  if (!fecha) return null;

  const entregaRegistrada = resultado.resultado;
  const total = contabilidad?.importe_definitivo ?? entregaRegistrada?.definitivo ?? null;
  // Las líneas y el total del resultado salen del mismo snapshot vigente.
  const coincidenImportes = total != null && total === entregaRegistrada?.definitivo;
  const productosRegistrados = new Map(entregaRegistrada?.productos.map(producto => [producto.item_pedido_id, producto]));

  return {
    numero: pedido.numeroPedido,
    destinatario: pedido.destinatarioEntrega?.trim() || pedido.nombreClienteSnapshot,
    fecha: formatDateTimeCL(fecha),
    total,
    productos: resultado.productos.map(producto => {
      const registro = productosRegistrados.get(producto.item_pedido_id);
      const formatear = (cantidad: number | null | undefined) => cantidad == null
        ? "Sin registro"
        : formatearCantidadPreparacionEntrega(cantidad, producto.nombre_presentacion, producto.unidad, registro?.modo_cantidad);
      return {
        nombre: producto.nombre_producto,
        presentacion: producto.nombre_presentacion,
        solicitada: formatear(producto.cantidad_pedida),
        entregada: formatear(registro?.cantidad_entregada),
        importe: coincidenImportes ? registro?.importe_definitivo ?? null : null,
      };
    }),
  };
}
