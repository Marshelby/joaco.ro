import Link from "next/link";
import type { ReactNode } from "react";

import type { FraccionDashboard } from "@/lib/admin/dashboard-comercial";

const moneda = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 2 });
const cantidad = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 8 });
const porcentaje = new Intl.NumberFormat("es-CL", { style: "percent", maximumFractionDigits: 2 });

export const clp = (valor: string | null) => valor === null ? "No disponible" : moneda.format(valor as `${number}`);
export const numero = (valor: string | null) => valor === null ? "No disponible" : cantidad.format(valor as `${number}`);
export function participacion(fraccion: FraccionDashboard | null) {
  if (!fraccion) return "No disponible";

  // SQL redondea el cociente a dos decimales. Usar la base exacta para
  // redondear al final, a dos decimales porcentuales.
  const [enteroNumerador, decimalNumerador = ""] = fraccion.numerador.split(".");
  const [enteroDenominador, decimalDenominador = ""] = fraccion.denominador.split(".");
  const escala = Math.max(decimalNumerador.length, decimalDenominador.length);
  const numerador = BigInt(enteroNumerador + decimalNumerador.padEnd(escala, "0"));
  const denominador = BigInt(enteroDenominador + decimalDenominador.padEnd(escala, "0"));
  if (denominador <= BigInt(0)) return "No disponible";
  const puntosBase = (numerador * BigInt(20_000) + denominador) / (denominador * BigInt(2));
  return `${porcentaje.format(Number(puntosBase) / 10_000)} · ${clp(fraccion.numerador)} de ${clp(fraccion.denominador)}`;
}

const estados = {
  completa: "Cobertura completa",
  parcial: "Cobertura parcial",
  sin_evidencia: "Sin evidencia suficiente",
  sin_ventas: "Sin ventas reconocidas",
  sin_ventas_reconocidas: "Sin ventas reconocidas",
  sin_identificar: "Sin clientes identificados",
  subconjunto_documentado: "Subconjunto documentado",
  sin_kg_comparables_documentados: "Sin kg comparables documentados",
  informacion_insuficiente: "Información insuficiente",
  informacion_no_disponible: "No disponible",
  cobertura_insuficiente: "Cobertura insuficiente",
} as const;

export function Cobertura({ estado }: { estado: keyof typeof estados }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${estado === "completa"
      ? "bg-emerald-100 text-emerald-900"
      : "bg-amber-50 text-amber-950"}`}>
      {estados[estado]}
    </span>
  );
}

export function Panel({ id, titulo, descripcion, children }: {
  id: string; titulo: string; descripcion?: string; children: ReactNode;
}) {
  return (
    <section id={id} tabIndex={-1} aria-labelledby={`${id}-titulo`} className="min-w-0 scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm [overflow-wrap:anywhere] sm:p-6">
      <h2 id={`${id}-titulo`} className="text-xl font-semibold tracking-tight">{titulo}</h2>
      {descripcion && <p className="mt-1 text-sm text-slate-600">{descripcion}</p>}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

export function Metrica({ titulo, valor, detalle }: { titulo: string; valor: string; detalle?: ReactNode }) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-3.5 sm:p-4">
      <dt className="text-sm font-medium text-slate-700">{titulo}</dt>
      <dd className="mt-1 text-xl font-semibold tracking-tight tabular-nums break-words">{valor}</dd>
      {detalle && <dd className="mt-1 text-xs leading-5 text-slate-600">{detalle}</dd>}
    </div>
  );
}

export function ErrorFuente() {
  return <p role="status" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-900">No se pudo cargar esta sección.</p>;
}

export function Tabla({ titulo, columnas, filas, pie, vacio }: {
  titulo: string; columnas: string[]; filas: { id: string; celdas: ReactNode[] }[]; pie: string; vacio: string;
}) {
  return (
    <div className="space-y-2">
      <h3 className="font-semibold">{titulo}</h3>
      {filas.length === 0 ? <p className="text-sm text-slate-600">{vacio}</p> : (
        <>
          <div tabIndex={0} role="region" aria-label={titulo} className="overflow-x-auto rounded-lg border border-slate-200 focus-visible:outline-2 focus-visible:outline-emerald-700">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">{titulo}</caption>
              <thead className="bg-slate-50 text-xs text-slate-700">
                <tr>{columnas.map((columna) => <th key={columna} scope="col" className="px-3 py-2.5 font-semibold">{columna}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100 tabular-nums">
                {filas.map(({ id, celdas }) => (
                  <tr key={id} className="hover:bg-slate-50">
                    <th scope="row" className="min-w-28 px-3 py-2.5 font-medium">{celdas[0]}</th>
                    {celdas.slice(1).map((celda, indice) => <td key={columnas[indice + 1]} className="px-3 py-2.5">{celda}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-600">{pie}</p>
        </>
      )}
    </div>
  );
}

export function EnlaceAdmin({ href, children }: { href: string; children: ReactNode }) {
  return <Link prefetch={false} href={href} className="font-medium text-emerald-800 underline decoration-emerald-600/50 underline-offset-4 hover:text-emerald-950">{children}</Link>;
}
