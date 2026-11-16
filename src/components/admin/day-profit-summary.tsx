import { leerComprasDia } from "@/lib/admin/compras-dia";

const clp = (n: number) => new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(n);
const cantidad = (n: number) => new Intl.NumberFormat("es-CL", { maximumFractionDigits: 3 }).format(n);

export async function DayProfitSummary({ fecha }: { fecha: string }) {
  const datos = await leerComprasDia(fecha);
  if (!datos || datos.contrato !== 2) return <p role="status" className="text-sm text-amber-800">Utilidad no disponible. No se pudo verificar el contrato de compras múltiples o sus datos. Recarga y revisa el acceso a las funciones de compras.</p>;
  const filas = datos.productos.map(p => {
    const cubierta = p.precio === null ? 0 : p.asignada ?? 0;
    const fraccion = p.requerida > 0 ? cubierta / p.requerida : 0;
    const venta = p.venta!;
    const ingreso = venta * fraccion;
    const costo = p.precio === null ? null : p.precio * cubierta;
    const utilidad = costo === null ? null : ingreso - costo;
    return { p, cubierta, venta, ingreso, costo, utilidad, pendiente: venta - ingreso };
  });
  const suma = (campo: "venta" | "ingreso" | "costo" | "utilidad" | "pendiente") => filas.reduce((s, f) => s + (f[campo] ?? 0), 0);
  const incompleta = filas.some(f => f.cubierta < f.p.requerida || f.p.requiere_ajuste || (f.costo === null && f.p.requerida > 0));
  const seguros = (["venta", "ingreso", "costo", "utilidad", "pendiente"] as const).every(k => Number.isFinite(suma(k)) && Math.abs(suma(k)) <= Number.MAX_SAFE_INTEGER);
  if (!seguros) return <p role="alert">Importes fuera del rango seguro; utilidad no disponible.</p>;
  const reconocida = filas.reduce((s, f) => s + (f.p.venta_reconocida ?? 0), 0);
  const sinDesglose = filas.some(f => (f.p.sin_desglose ?? 0) > 0);
  const margen = (u: number | null, venta: number) => u === null || venta === 0 ? "—" : `${(100 * u / venta).toFixed(1)} %`;
  return <section className="space-y-3 text-xs" aria-label="Utilidad del día">
    <p className="font-semibold">UTILIDAD BRUTA ESTIMADA · {fecha}</p>
    <p className="text-muted-foreground">Venta proyectada: suma de los importes reales de cada línea de pedido, sin promediar precios de venta. Para la parte comprada, los ingresos se estiman proporcionalmente a la cantidad de cada línea; no representan una entrega ni una venta reconocida.</p>
    {incompleta && <p role="status" className="rounded border border-amber-500/40 p-2">Resultado parcial pendiente de compras o revisión. No hay una utilidad total definitiva; los costos pendientes no se estiman.</p>}
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">{[["Venta proyectada", clp(suma("venta"))], ["Ingreso estimado parte comprada", clp(suma("ingreso"))], ["Costo estimado parte comprada", clp(suma("costo"))], ["Utilidad estimada parte comprada", clp(suma("utilidad"))], ["Venta pendiente de costo", clp(suma("pendiente"))], ["Margen parte comprada", margen(suma("utilidad"), suma("ingreso"))]].map(([t,v]) => <div key={t}><dt className="text-muted-foreground">{t}</dt><dd className="font-semibold">{v}</dd></div>)}</dl>
    <p>Ventas efectivamente reconocidas de productos con desglose verificable: {Number.isSafeInteger(reconocida) ? clp(reconocida) : "No disponible"}.{sinDesglose && " Subtotal incompleto: existen ventas reconocidas sin desglose verificable por producto."} Se utiliza el snapshot definitivo y su última corrección. Consulta Resumen contable para el total exigible del pedido.</p>
    <ul className="grid gap-2 sm:grid-cols-2">{filas.map(f => <li key={f.p.clave} className="space-y-1 rounded border p-3"><p className="font-semibold">{f.p.producto} · {f.p.presentacion ?? f.p.unidad}</p><p>Necesitamos: {cantidad(f.p.requerida)} · Compramos para estos pedidos: {cantidad(f.cubierta)} · Faltan: {cantidad(Math.max(0,f.p.requerida-f.cubierta))}</p><p>Venta proyectada: {clp(f.venta)} · Parte comprada: {clp(f.ingreso)}</p><p>Costo: {f.costo === null ? "Pendiente" : clp(f.costo)} · Utilidad: {f.utilidad === null ? "Pendiente" : clp(f.utilidad)} · Margen: {margen(f.utilidad,f.ingreso)}</p><p>Venta pendiente de costo: {clp(f.pendiente)}</p><p>Venta reconocida verificable: {f.p.venta_reconocida === null ? "Sin desglose" : clp(f.p.venta_reconocida ?? 0)}{(f.p.sin_desglose ?? 0) > 0 ? " · Desglose incompleto" : ""}</p>{f.p.requiere_ajuste && <p className="text-amber-800">Compras históricas pendientes de revisión.</p>}</li>)}</ul>
    <p className="text-muted-foreground">Costo promedio ponderado = suma de cantidad × precio de compra / cantidad comprada. El costo considerado se limita a la demanda; los excedentes quedan fuera. Importes CLP redondeados solo al mostrar; no incluye reparto, otros gastos operativos ni impuestos adicionales.</p>
  </section>;
}
