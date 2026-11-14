import type { ContabilidadRutaPedido, ContabilidadRutas } from "@/lib/admin/rutas-contabilidad";
import { formatCLP } from "@/lib/formatters";

export function RutasContabilidadPedido({ resumen }: { resumen?: ContabilidadRutaPedido | null }) {
  if (!resumen) return <p className="px-3 py-2 text-xs text-muted-foreground">Contabilidad no disponible · Consulta el detalle del pedido.</p>;
  if (!resumen.venta_reconocida) return <p className="px-3 py-2 text-xs text-muted-foreground">{resumen.regimen === "legado" ? "Pedido legado sin venta definitiva verificable" : "Sin venta reconocida"} · Sin importes definitivos.</p>;
  return <div className="space-y-1 border-t bg-muted/20 px-3 py-2 text-xs tabular-nums" aria-label="Contabilidad del pedido">
    <dl className="grid grid-cols-3 gap-2">{[["Definitivo", resumen.importe_definitivo], ["Aplicado", resumen.total_aplicado], ["Saldo del pedido", resumen.saldo_pedido]].map(([nombre, monto]) => <div key={String(nombre)}><dt className="text-muted-foreground">{nombre}</dt><dd className="break-words font-semibold">{typeof monto === "number" ? formatCLP(monto) : "No disponible"}</dd></div>)}</dl>
    <p className="break-words text-muted-foreground">{resumen.aplicaciones.length ? `Aplicaciones confirmadas: ${resumen.aplicaciones.map(a => `${a.metodo.replaceAll("_", " ")}: ${formatCLP(a.monto)}`).join(" · ")}` : "Sin pagos aplicados"}</p>
  </div>;
}

export function RutasContabilidadJornada({ datos, ids }: { datos: ContabilidadRutas | null; ids: string[] }) {
  const filas = [...new Set(ids)].map(id => datos?.[id]);
  const completas = filas.length > 0 && filas.every(r => r?.venta_reconocida && r.importe_definitivo !== null && r.total_aplicado !== null && r.saldo_pedido !== null);
  const campos = ["importe_definitivo", "total_aplicado", "saldo_pedido"] as const;
  const totales = completas ? campos.map(k => filas.reduce((s, r) => s + (r![k] ?? 0), 0)) : null;
  return <section className="rounded-xl border bg-card px-4 py-3" aria-label="Resumen contable de jornada">
    <p className="text-sm font-semibold">Contabilidad de la jornada</p>
    {totales?.every(Number.isSafeInteger) ? <dl className="mt-2 grid grid-cols-3 gap-3 text-xs tabular-nums">{["Definitivo", "Aplicado", "Saldo de pedidos"].map((t, n) => <div key={t}><dt className="text-muted-foreground">{t}</dt><dd className="break-words text-sm font-semibold">{formatCLP(totales[n])}</dd></div>)}</dl> : <p className="mt-1 text-xs text-muted-foreground">Sin totales: {datos === null ? "lectura contable no disponible" : "se requieren ventas reconocidas y datos completos de todos los pedidos"}.</p>}
    <p className="mt-2 text-xs text-muted-foreground">Saldos actuales de estos pedidos, incluso en fechas pasadas. Aplicaciones confirmadas por método real; no incluye deuda global ni suma nuevamente los cobros de entrega.</p>
  </section>;
}
