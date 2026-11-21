import { presentarResultadoEntrega, productoSolicitado } from "@/components/admin/delivery-result";
import { fechaEntregaDefinitiva, prepararGuiaEntrega } from "@/lib/admin/guia-entrega";
import { obtenerResumenContablePedido } from "@/lib/admin/pedido-contabilidad";
import { obtenerPedidoAdmin } from "@/lib/admin/pedidos";
import { obtenerResultadosEntrega } from "@/lib/admin/resultado-entrega";
import { exigirSesionAdmin } from "@/lib/admin/sesion";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await exigirSesionAdmin();
  const { id } = await params;
  if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)) {
    return new Response(null, { status: 404 });
  }

  const pedido = await obtenerPedidoAdmin(id);
  if (!pedido || !fechaEntregaDefinitiva(pedido)) return new Response(null, { status: 404 });

  const [resultados, contabilidad] = await Promise.all([
    obtenerResultadosEntrega([id]),
    obtenerResumenContablePedido(id),
  ]);
  const resultado = presentarResultadoEntrega(pedido.estado, pedido.total, resultados[id],
    pedido.items.map(item => productoSolicitado(item.id, item.nombreProductoSnapshot, item.nombrePresentacionSnapshot, item.unidadSnapshot, item.cantidad, item.totalLinea)));

  return Response.json(prepararGuiaEntrega(pedido, resultado, contabilidad), {
    headers: { "Cache-Control": "private, no-store" },
  });
}
