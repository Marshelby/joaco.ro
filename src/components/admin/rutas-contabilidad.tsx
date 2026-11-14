import type { ContabilidadRutaPedido, ContabilidadRutas } from "@/lib/admin/rutas-contabilidad";
import { formatCLP } from "@/lib/formatters";

function PagosPorMetodo({ aplicaciones }: { aplicaciones: ContabilidadRutaPedido["aplicaciones"] }) {
  const montos = new Map<string, number>();
  for (const { metodo, monto } of aplicaciones) montos.set(metodo, (montos.get(metodo) ?? 0) + monto);
  return <div className="mt-1 space-y-1 font-normal text-muted-foreground">{montos.size ? [...montos].map(([metodo, monto]) => <p key={metodo} className="break-words">{metodo.replaceAll("_", " ").replace(/^./, letra => letra.toUpperCase())} {formatCLP(monto)}</p>) : <p>Sin pagos realizados</p>}</div>;
}

export function RutasContabilidadPedido({ resumen }: { resumen?: ContabilidadRutaPedido | null }) {
  if (!resumen) return <p className="px-3 py-2 text-xs text-muted-foreground">Contabilidad no disponible · Consulta el detalle del pedido.</p>;
  if (!resumen.venta_reconocida) return <p className="px-3 py-2 text-xs text-muted-foreground">{resumen.regimen === "legado" ? "Pedido legado sin venta reconocida verificable" : "Sin venta reconocida"} · Sin valor del pedido verificable.</p>;
  return <div className="space-y-1 border-t bg-muted/20 px-3 py-2 text-xs tabular-nums" aria-label="Contabilidad del pedido">
    <dl className="grid grid-cols-3 gap-2">{[["Valor del pedido", resumen.importe_definitivo], ["Pago realizado", resumen.total_aplicado], ["Pago pendiente", resumen.saldo_pedido]].map(([nombre, monto]) => <div key={String(nombre)}><dt className="text-muted-foreground">{nombre}</dt><dd className="break-words font-semibold">{typeof monto === "number" ? formatCLP(monto) : "No disponible"}{nombre === "Pago realizado" && <PagosPorMetodo aplicaciones={resumen.aplicaciones} />}</dd></div>)}</dl>
  </div>;
}

export function RutasContabilidadJornada({ datos, ids }: { datos: ContabilidadRutas | null; ids: string[] }) {
  const filas = [...new Set(ids)].map(id => datos?.[id]);
  const completas = filas.length > 0 && filas.every(r => r?.venta_reconocida && r.importe_definitivo !== null && r.total_aplicado !== null && r.saldo_pedido !== null);
  const campos = ["importe_definitivo", "total_aplicado", "saldo_pedido"] as const;
  const totales = completas ? campos.map(k => filas.reduce((s, r) => s + (r![k] ?? 0), 0)) : null;
  return <section className="rounded-xl border bg-card px-4 py-3" aria-label="Resumen contable de jornada">
    <p className="text-sm font-semibold">Contabilidad de la jornada</p>
    {totales?.every(Number.isSafeInteger) ? <dl className="mt-2 grid grid-cols-3 gap-3 text-xs tabular-nums">{["Valor del pedido", "Pago realizado", "Pago pendiente"].map((t, n) => <div key={t}><dt className="text-muted-foreground">{t}</dt><dd className="break-words text-sm font-semibold">{formatCLP(totales[n])}{n === 1 && <PagosPorMetodo aplicaciones={filas.flatMap(r => r!.aplicaciones)} />}</dd></div>)}</dl> : <p className="mt-1 text-xs text-muted-foreground">Sin totales: {datos === null ? "lectura contable no disponible" : "se requieren ventas reconocidas y datos completos de todos los pedidos"}.</p>}
    <p className="mt-2 text-xs text-muted-foreground">Saldos actuales de estos pedidos, incluso en fechas pasadas. Pagos confirmados por método real; no incluye deuda global ni suma nuevamente los cobros de entrega.</p>
  </section>;
}
