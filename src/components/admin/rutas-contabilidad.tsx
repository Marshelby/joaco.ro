import Link from "next/link";
import { ROUTES } from "@/config/routes";
import type { ContabilidadRutaPedido, ContabilidadRutas } from "@/lib/admin/rutas-contabilidad";
import { formatCLP } from "@/lib/formatters";

function PagosPorMetodo({ aplicaciones }: { aplicaciones: ContabilidadRutaPedido["aplicaciones"] }) {
  const montos = new Map<string, number>();
  for (const { metodo, monto } of aplicaciones) montos.set(metodo, (montos.get(metodo) ?? 0) + monto);
  return <div className="mt-1 space-y-1 font-normal text-muted-foreground">{montos.size ? [...montos].map(([metodo, monto]) => <p key={metodo} className="break-words">{metodo.replaceAll("_", " ").replace(/^./, letra => letra.toUpperCase())} {formatCLP(monto)}</p>) : <p>Sin pagos aplicados</p>}</div>;
}

export function RutasContabilidadPedido({ resumen, totalCobrado }: { resumen?: ContabilidadRutaPedido | null; totalCobrado?: number | null }) {
  if (!resumen) return <p className="px-3 py-2 text-xs text-muted-foreground">Contabilidad no disponible · Consulta el detalle del pedido.</p>;
  if (!resumen.venta_reconocida) return <p className="px-3 py-2 text-xs text-muted-foreground">{resumen.regimen === "legado" ? "Pedido legado sin venta reconocida verificable" : "Sin venta reconocida"} · Sin valor del pedido verificable.</p>;
  return <div className="space-y-1 border-t bg-muted/20 px-3 py-2 text-xs tabular-nums" aria-label="Contabilidad del pedido">
    <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <div><dt className="text-muted-foreground">Importe definitivo</dt><dd className="break-words font-semibold">{resumen.importe_definitivo === null ? "No registrado" : formatCLP(resumen.importe_definitivo)}</dd></div>
      {totalCobrado !== undefined && <div><dt className="text-muted-foreground">Total cobrado en la entrega</dt><dd className="break-words font-semibold">{totalCobrado === null ? "No registrado" : formatCLP(totalCobrado)}</dd></div>}
      <div><dt className="text-muted-foreground">Pagos aplicados</dt><dd className="break-words font-semibold">{resumen.total_aplicado === null ? "No registrado" : formatCLP(resumen.total_aplicado)}<PagosPorMetodo aplicaciones={resumen.aplicaciones} /></dd></div>
      <div><dt className="text-muted-foreground">Saldo pendiente</dt><dd className="break-words font-semibold">{resumen.saldo_pedido === null ? "No registrado" : formatCLP(resumen.saldo_pedido)}</dd></div>
    </dl>
  </div>;
}

type PedidoJornada = { id: string; clienteId: string | null; nombreClienteSnapshot: string; numeroPedido: string };
const identificadorValido = (id: string | null): id is string => !!id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

export function RutasContabilidadJornada({ datos, pedidos }: { datos: ContabilidadRutas | null; pedidos: readonly PedidoJornada[] }) {
  const unicos = [...new Map(pedidos.map(p => [p.id, p])).values()];
  const verificables = unicos.flatMap(p => {
    const r = datos?.[p.id];
    return r?.venta_reconocida && r.importe_definitivo !== null && r.total_aplicado !== null && r.saldo_pedido !== null ? [{ pedido: p, resumen: r }] : [];
  });
  const sinVenta = unicos.filter(p => datos?.[p.id]?.venta_reconocida === false).length;
  const faltantes = unicos.length - verificables.length - sinVenta;
  const campos = ["importe_definitivo", "total_aplicado", "saldo_pedido"] as const;
  const totales = campos.map(k => verificables.reduce((s, { resumen }) => s + resumen[k]!, 0));
  const seguros = totales.every(Number.isSafeInteger);
  const clientes = new Map<string, { nombre: string; id: string | null; filas: typeof verificables }>();
  for (const fila of verificables) {
    const p = fila.pedido;
    const id = identificadorValido(p.clienteId) ? p.clienteId : null;
    const clave = id ?? p.id;
    const cliente = clientes.get(clave) ?? { nombre: p.nombreClienteSnapshot, id, filas: [] };
    cliente.filas.push(fila);
    clientes.set(clave, cliente);
  }
  return <section className="space-y-3 text-xs" aria-label="Resumen contable de jornada">
    <p className="font-semibold">Pedidos de la fecha seleccionada · saldos actuales</p>
    {(faltantes > 0 || datos === null || !seguros) && <p role="status" className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2">Cobertura incompleta: {verificables.length} de {unicos.length} pedidos con venta reconocida e importes verificables. {faltantes} sin datos suficientes. Los importes son subtotales; no representan el total de la jornada.{!seguros && " Suma fuera del rango seguro: importes agregados ocultos."}</p>}
    <p className="text-muted-foreground">{sinVenta} pedidos sin venta reconocida excluidos. {verificables.length} pedidos incluidos de {unicos.length}.</p>
    {seguros && datos !== null && (verificables.length > 0 || faltantes === 0) && <dl className="grid grid-cols-3 gap-2 tabular-nums">{["Valor total de pedidos entregados", "Total pagado", "Total pendiente"].map((titulo, n) => <div key={titulo}><dt className="text-muted-foreground">{faltantes > 0 ? "Subtotal · " : ""}{titulo}</dt><dd className="break-words text-sm font-semibold">{formatCLP(totales[n])}</dd></div>)}</dl>}
    {seguros && verificables.length > 0 && <><div><p className="font-semibold">Aplicaciones por método real</p><PagosPorMetodo aplicaciones={verificables.flatMap(f => f.resumen.aplicaciones)} /></div>
      <ul className="max-h-80 space-y-2 overflow-y-auto overscroll-contain" aria-label="Desglose por cliente">{[...clientes].map(([clave, cliente]) => <li key={clave} className="rounded-md border p-2">
        <p className="break-words font-semibold">{cliente.id ? <Link prefetch={false} href={ROUTES.adminCustomer(cliente.id)} className="text-primary underline underline-offset-2">{cliente.nombre}</Link> : cliente.nombre}</p>
        <ul className="mt-2 space-y-2">{cliente.filas.map(({ pedido, resumen }) => <li key={pedido.id} className="overflow-hidden rounded-md border">
          <Link prefetch={false} href={ROUTES.adminOrder(pedido.id)} className="block px-3 py-2 font-semibold text-primary underline underline-offset-2">Pedido {pedido.numeroPedido}</Link>
          <RutasContabilidadPedido resumen={resumen} />
        </li>)}</ul>
      </li>)}</ul></>}
    {faltantes > 0 && <details className="rounded-md border p-2"><summary className="min-h-11 cursor-pointer py-2 font-semibold">Pedidos sin cobertura contable ({faltantes})</summary><ul className="max-h-48 space-y-1 overflow-y-auto">{unicos.filter(p => !datos?.[p.id] || (datos[p.id].venta_reconocida && !verificables.some(f => f.pedido.id === p.id))).map(p => <li key={p.id} className="break-words">{identificadorValido(p.clienteId) ? <Link prefetch={false} href={ROUTES.adminCustomer(p.clienteId)} className="text-primary underline">{p.nombreClienteSnapshot}</Link> : p.nombreClienteSnapshot} · {p.numeroPedido} · Saldo no verificable</li>)}</ul></details>}
    <p className="text-muted-foreground">Valores definitivos reconocidos y pagos confirmados aplicados a estos pedidos. Para fechas anteriores se muestran sus pagos y saldos actuales.</p>
  </section>;
}
