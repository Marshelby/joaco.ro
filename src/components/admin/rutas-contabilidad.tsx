import Link from "next/link";
import { bloqueJornada, cuadriculaDetalleJornada, importeJornada, tonoJornada } from "@/components/admin/jornada-colores";
import { ROUTES } from "@/config/routes";
import type { ContabilidadRutaPedido, ContabilidadRutas } from "@/lib/admin/rutas-contabilidad";
import { formatCLP } from "@/lib/formatters";

function PagosPorMetodo({ aplicaciones, vistaJornada = false }: { aplicaciones: ContabilidadRutaPedido["aplicaciones"]; vistaJornada?: boolean }) {
  const montos = new Map<string, number>();
  for (const { metodo, monto } of aplicaciones) montos.set(metodo, (montos.get(metodo) ?? 0) + monto);
  return <div className="mt-1 space-y-1 font-normal text-muted-foreground">{montos.size ? [...montos].map(([metodo, monto]) => <p key={metodo} className="break-words">{metodo.replaceAll("_", " ").replace(/^./, letra => letra.toUpperCase())} <span className={vistaJornada ? `${importeJornada} ${tonoJornada.completado}` : undefined}>{formatCLP(monto)}</span></p>) : <p className={vistaJornada ? `${importeJornada} ${tonoJornada.informativo}` : undefined}>Sin pagos aplicados</p>}</div>;
}

export function RutasContabilidadPedido({ resumen, totalCobrado, ocultarImporte = false, vistaJornada = false, vistaRuta = false }: { resumen?: ContabilidadRutaPedido | null; totalCobrado?: number | null; ocultarImporte?: boolean; vistaJornada?: boolean; vistaRuta?: boolean }) {
  if (!resumen) return <p className="px-3 py-2 text-xs text-muted-foreground">Contabilidad no disponible · Consulta el detalle del pedido.</p>;
  if (!resumen.venta_reconocida) return <p className="px-3 py-2 text-xs text-muted-foreground">{resumen.regimen === "legado" ? "Pedido legado sin venta reconocida verificable" : "Sin venta reconocida"} · Sin valor del pedido verificable.</p>;
  const importe = (tono: keyof typeof tonoJornada) => vistaRuta || vistaJornada ? `${importeJornada} ${tonoJornada[tono]}` : undefined;
  return <div className={vistaRuta ? "min-w-0 rounded-lg border border-border bg-muted/20 p-2" : "space-y-1 border-t bg-muted/20 px-3 py-2 text-xs tabular-nums"} aria-label="Contabilidad del pedido">
    <dl className={vistaRuta ? cuadriculaDetalleJornada : `grid grid-cols-2 gap-2 ${vistaJornada ? "sm:grid-cols-3" : "sm:grid-cols-4"}`}>
      {!ocultarImporte && <div><dt className="text-muted-foreground">Importe definitivo</dt><dd className="break-words font-semibold"><span className={importe(resumen.importe_definitivo === null ? "informativo" : "venta")}>{resumen.importe_definitivo === null ? "No registrado" : formatCLP(resumen.importe_definitivo)}</span></dd></div>}
      {totalCobrado !== undefined && <div><dt className="text-muted-foreground">Total cobrado en la entrega</dt><dd className="break-words font-semibold"><span className={vistaRuta ? importe(totalCobrado === null ? "informativo" : "completado") : undefined}>{totalCobrado === null ? "No registrado" : formatCLP(totalCobrado)}</span></dd></div>}
      <div><dt className="text-muted-foreground">Pagos aplicados</dt><dd className="break-words font-semibold"><span className={importe(resumen.total_aplicado === null ? "informativo" : "completado")}>{resumen.total_aplicado === null ? "No registrado" : formatCLP(resumen.total_aplicado)}</span><PagosPorMetodo aplicaciones={resumen.aplicaciones} vistaJornada={vistaJornada || vistaRuta} /></dd></div>
      <div><dt className="text-muted-foreground">Saldo pendiente</dt><dd className="break-words font-semibold"><span className={importe(resumen.saldo_pedido != null && resumen.saldo_pedido > 0 ? "pendiente" : "informativo")}>{resumen.saldo_pedido === null ? "No registrado" : formatCLP(resumen.saldo_pedido)}</span></dd></div>
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
    {(faltantes > 0 || datos === null || !seguros) && <p role="status" className={`${bloqueJornada} ${seguros ? tonoJornada.informativo : tonoJornada.incidencia}`}>Cobertura incompleta: {verificables.length} de {unicos.length} pedidos con venta reconocida e importes verificables. {faltantes} sin datos suficientes. Los importes son subtotales; no representan el total de la jornada.{!seguros && " Suma fuera del rango seguro: importes agregados ocultos."}</p>}
    <p className="text-muted-foreground">{sinVenta} pedidos sin venta reconocida excluidos. {verificables.length} pedidos incluidos de {unicos.length}.</p>
    {seguros && datos !== null && (verificables.length > 0 || faltantes === 0) && <dl className="grid grid-cols-1 gap-2 tabular-nums min-[400px]:grid-cols-3">{[
      ["Valor total de pedidos entregados", tonoJornada.venta],
      ["Total pagado", tonoJornada.completado],
      ["Total pendiente", totales[2] > 0 ? tonoJornada.pendiente : tonoJornada.informativo],
    ].map(([titulo, tono], n) => <div key={titulo} className={`${bloqueJornada} ${tono}`}>
      <dt>{faltantes > 0 ? "Subtotal · " : ""}{titulo}</dt>
      <dd className="mt-0.5 text-sm font-semibold">{formatCLP(totales[n])}</dd>
    </div>)}</dl>}
    {seguros && verificables.length > 0 && <><div><p className="font-semibold">Aplicaciones por método real</p><PagosPorMetodo aplicaciones={verificables.flatMap(f => f.resumen.aplicaciones)} vistaJornada /></div>
      <ul className="max-h-80 space-y-2 overflow-y-auto overscroll-contain" aria-label="Desglose por cliente">{[...clientes].map(([clave, cliente]) => <li key={clave} className="rounded-md border p-2">
        <p className="break-words font-semibold">{cliente.id ? <Link prefetch={false} href={ROUTES.adminCustomer(cliente.id)} className="text-primary underline underline-offset-2">{cliente.nombre}</Link> : cliente.nombre}</p>
        <ul className="mt-2 space-y-2">{cliente.filas.map(({ pedido, resumen }) => <li key={pedido.id} className="overflow-hidden rounded-md border">
          <Link prefetch={false} href={ROUTES.adminOrder(pedido.id)} className="block px-3 py-2 font-semibold text-primary underline underline-offset-2">Pedido {pedido.numeroPedido}</Link>
          <RutasContabilidadPedido resumen={resumen} vistaJornada />
        </li>)}</ul>
      </li>)}</ul></>}
    {faltantes > 0 && <details className="rounded-md border p-2"><summary className="min-h-11 cursor-pointer py-2 font-semibold">Pedidos sin cobertura contable ({faltantes})</summary><ul className="max-h-48 space-y-1 overflow-y-auto">{unicos.filter(p => !datos?.[p.id] || (datos[p.id].venta_reconocida && !verificables.some(f => f.pedido.id === p.id))).map(p => <li key={p.id} className="break-words">{identificadorValido(p.clienteId) ? <Link prefetch={false} href={ROUTES.adminCustomer(p.clienteId)} className="text-primary underline">{p.nombreClienteSnapshot}</Link> : p.nombreClienteSnapshot} · {p.numeroPedido} · Saldo no verificable</li>)}</ul></details>}
    <p className="text-muted-foreground">Valores definitivos reconocidos y pagos confirmados aplicados a estos pedidos. Para fechas anteriores se muestran sus pagos y saldos actuales.</p>
  </section>;
}
