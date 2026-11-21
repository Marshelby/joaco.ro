import { obtenerCantidadPedidosRecibidos } from "@/lib/admin/pedidos";

export default async function ContadorPedidos() {
  const cantidad = await obtenerCantidadPedidosRecibidos();

  return <span className="whitespace-nowrap rounded bg-sky-500/10 px-1 text-xs font-bold tabular-nums">({cantidad})</span>;
}
