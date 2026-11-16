import type { ReactNode } from "react";
import { leerComprasDia } from "@/lib/admin/compras-dia";

const clp = (n: number) => new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0, useGrouping: "always" }).format(n);
const cantidad = (n: number) => new Intl.NumberFormat("es-CL", { maximumFractionDigits: 3 }).format(n);

function indicadorUtilidad(monto: ReactNode, parcial = false, color = "text-muted-foreground") {
  return <div className="col-span-2 min-w-0 rounded-lg bg-muted/40 px-3 py-2 sm:col-span-1">
    <dt className="text-xs text-muted-foreground">Utilidad estimada</dt>
    <dd className={`mt-1 break-words text-lg font-semibold tabular-nums ${color}`}>{monto}</dd>
    {parcial && <dd className="mt-1 text-[11px] text-amber-800 dark:text-amber-200">Parcial · compras o costos pendientes</dd>}
  </div>;
}

export async function DayProfitSummary({ fecha }: { fecha: string }) {
  return (await obtenerPresentacionUtilidadDia(fecha)).detalle;
}

// Ambas vistas comparten una única lectura y el mismo cálculo de utilidad.
export async function obtenerPresentacionUtilidadDia(fecha: string) {
  const datos = await leerComprasDia(fecha);
  if (!datos || ![2, 3].includes(datos.contrato)) return { indicador: indicadorUtilidad("No disponible"), detalle: <p role="status" className="text-sm text-amber-800">Utilidad no disponible. No se pudo verificar el contrato de compras múltiples o sus datos. Recarga y revisa el acceso a las funciones de compras.</p> };
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
  if (!seguros) return { indicador: indicadorUtilidad("No disponible"), detalle: <p role="alert">Importes fuera del rango seguro; utilidad no disponible.</p> };
  const margen = (u: number | null, venta: number) => u === null || venta === 0 ? "—" : `${(100 * u / venta).toFixed(1)} %`;
  const colorUtilidad = (valor: number | null) => valor !== null && valor < 0 ? "text-red-700" : valor !== null && valor > 0 ? "text-emerald-700" : "text-muted-foreground";
  const utilidadTotal = filas.length > 0 && filas.every(f => f.utilidad === null) ? null : suma("utilidad");
  const detalle = <section className="min-w-0 space-y-3 text-xs" aria-label="Utilidad del día">
    <div role="region" aria-label="Detalle de utilidad por producto" tabIndex={0} className="overflow-x-auto rounded-lg border focus-visible:outline-2 focus-visible:outline-ring">
      <table className="w-full min-w-[640px] text-left tabular-nums">
        <thead className="bg-muted/50 text-muted-foreground">
          <tr>
            <th scope="col" className="px-3 py-2 font-medium">Producto</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">Cantidad comprada</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">Cantidad vendida</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">Venta</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">Compra</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">Utilidad</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {filas.map(f => {
            const unidad = f.p.modo === "kg_fraccionable" ? "kg" : f.p.modo === "presentacion_cerrada" ? `presentación (${f.p.presentacion ?? f.p.unidad})` : f.p.modo === "unidad" ? "unidad" : f.p.unidad;
            const faltan = Math.max(0, Math.round((f.p.requerida - f.cubierta) * 1000) / 1000);
            const parcial = f.cubierta < f.p.requerida || f.p.requiere_ajuste;
            return <tr key={f.p.clave}>
              <th scope="row" className="px-3 py-2 align-top font-medium">
                {f.p.producto}
                <span className="block font-normal text-muted-foreground">{f.p.presentacion ?? f.p.unidad}</span>
              </th>
              <td className="px-3 py-2 text-right align-top">
                {cantidad(f.cubierta)} {unidad}
                {faltan > 0 && <span className="block text-[11px] text-amber-800">Pendiente: {cantidad(faltan)} {unidad}</span>}
                {f.p.requiere_ajuste && <span className="block text-[11px] text-amber-800">Compra por revisar</span>}
              </td>
              <td className="px-3 py-2 text-right align-top">{cantidad(f.p.requerida)} {unidad}</td>
              <td className="whitespace-nowrap px-3 py-2 text-right align-top">{clp(f.venta)}</td>
              <td className="whitespace-nowrap px-3 py-2 text-right align-top">{f.costo === null ? "Pendiente" : clp(f.costo)}</td>
              <td className={`whitespace-nowrap px-3 py-2 text-right align-top font-medium ${colorUtilidad(f.utilidad)}`}>
                {f.utilidad === null ? "Pendiente" : clp(f.utilidad)}
                {parcial && f.utilidad !== null && <span className="block text-[11px] font-normal text-amber-800">Parcial</span>}
              </td>
            </tr>;
          })}
          {filas.length === 0 && <tr><td colSpan={6} className="px-3 py-4 text-center text-muted-foreground">No hay productos para esta fecha.</td></tr>}
        </tbody>
        <tfoot className="border-t bg-muted/50 font-semibold">
          <tr>
            <th scope="row" colSpan={3} className="px-3 py-2">TOTAL</th>
            <td className="whitespace-nowrap px-3 py-2 text-right">{clp(suma("venta"))}</td>
            <td className="whitespace-nowrap px-3 py-2 text-right">{utilidadTotal === null ? "Pendiente" : clp(suma("costo"))}</td>
            <td className={`whitespace-nowrap px-3 py-2 text-right ${colorUtilidad(utilidadTotal)}`}>
              {utilidadTotal === null ? "Pendiente" : clp(utilidadTotal)}
              {incompleta && <span className="block text-[11px] font-normal text-amber-800">Parcial</span>}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-3">
      <p className="font-semibold">UTILIDAD BRUTA ESTIMADA TOTAL{incompleta && <span className="ml-2 font-normal text-amber-800">Parcial</span>}</p>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className={`text-xl font-semibold tabular-nums ${colorUtilidad(utilidadTotal)}`}>{utilidadTotal === null ? "Pendiente" : clp(utilidadTotal)}</p>
        <p className="text-muted-foreground">Margen{incompleta ? " parcial" : ""}: {margen(utilidadTotal, suma("ingreso"))}</p>
      </div>
    </div>
    <p className="text-[11px] text-muted-foreground">Estimación basada en pedidos del día, no necesariamente entregados; no incluye reparto ni otros gastos.</p>
  </section>;
  return {
    detalle,
    indicador: indicadorUtilidad(utilidadTotal === null ? "Pendiente" : clp(utilidadTotal), incompleta, colorUtilidad(utilidadTotal)),
  };
}
