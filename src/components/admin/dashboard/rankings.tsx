import type { FraccionDashboard, RankingsDashboard } from "@/lib/admin/dashboard-comercial";

import { clp, Cobertura, EnlaceAdmin, ErrorFuente, Metrica, numero, Panel, participacion, Tabla } from "./piezas";

type PeriodoRanking = RankingsDashboard["periodos"]["actual"];
const limiteVisible = 8;
const pieRanking = (filas: number, candidatos: string) => `${numero(String(filas))} de ${numero(candidatos)} candidatos`;

function Productos({ actual }: { actual: PeriodoRanking }) {
  const { rankings_productos: rankings, cobertura } = actual;
  const modos = [
    { titulo: "Por facturación de líneas verificadas", lista: rankings.facturacion, unidad: "Facturación (CLP)", base: "Participación en líneas verificadas" },
    { titulo: "Por pedidos con entrega", lista: rankings.pedidos, unidad: "Pedidos", base: "Alcance" },
    { titulo: "Por peso fraccionable documentado", lista: rankings.kg_fraccionables_documentados, unidad: "Peso (kg)", base: "Base" },
  ] as const;

  return (
    <Panel id="productos" titulo="Productos más vendidos" descripcion="Productos identificados en las líneas de entrega verificadas.">
      <div className="flex flex-wrap gap-2">
        <span className="text-sm">Ventas <Cobertura estado={cobertura.estado_ventas} /></span>
        <span className="text-sm">Productos <Cobertura estado={cobertura.estado_productos} /></span>
      </div>
      {cobertura.estado_productos === "parcial" && <p className="text-sm text-slate-700">{numero(cobertura.pedidos_sin_lineas_verificadas)} pedidos sin líneas verificadas y {numero(cobertura.lineas_sin_producto)} líneas sin producto identificado.</p>}
      {modos.map(({ titulo, lista, unidad, base }, indice) => {
        const filas = lista.filas.slice(0, limiteVisible);
        return (
          <details key={titulo} open={indice === 0 ? true : undefined} className="border-t border-slate-100 pt-3">
            <summary className="cursor-pointer text-sm font-semibold text-emerald-900">{titulo}</summary>
            <div className="mt-3 space-y-2">
              {indice === 2 && (
                <div className="space-y-2">
                  <Cobertura estado={cobertura.estado_kg} />
                  {cobertura.estado_kg === "subconjunto_documentado" && (
                    <p className="text-sm text-slate-700">{numero(cobertura.lineas_con_cantidad_desconocida)} líneas con cantidad desconocida y {numero(cobertura.lineas_entregadas_fuera_de_kg_fraccionable_documentado)} líneas entregadas fuera del peso fraccionable documentado.</p>
                  )}
                </div>
              )}
              <Tabla titulo={titulo} columnas={["Producto", unidad, base]}
                filas={filas.map((p) => ({
                  id: p.producto_id,
                  celdas: [
                    p.nombre_producto_snapshot ?? "Producto sin nombre disponible",
                    indice === 0 ? clp(p.facturacion_lineas_clp) : indice === 1 ? numero(p.pedidos_con_entrega) : numero(p.kg_fraccionables_documentados),
                    indice === 0 ? participacion(p.participacion_subtotal_lineas_verificadas) :
                      indice === 1 ? "Pedidos con ese producto" : `${numero(p.lineas_kg_fraccionable)} líneas documentadas`,
                  ],
                }))}
                pie={pieRanking(filas.length, lista.candidatos)}
                vacio={cobertura.estado_ventas === "sin_evidencia" ? "Sin evidencia suficiente para ordenar productos." : "Sin productos verificables para este ranking."} />
            </div>
          </details>
        );
      })}
      <EnlaceAdmin href="/admin/productos">Ir a productos</EnlaceAdmin>
    </Panel>
  );
}

function Clientes({ actual }: { actual: PeriodoRanking }) {
  const { rankings_clientes: rankings, cobertura, concentracion_clientes: concentracion } = actual;
  const clientes = rankings.facturacion.filas.slice(0, limiteVisible);
  const frecuentes = rankings.frecuencia.filas.slice(0, limiteVisible);
  return (
    <Panel id="clientes" titulo="Clientes principales" descripcion="Facturación reconocida por cliente identificado.">
      <div className="flex flex-wrap gap-2">
        <span className="text-sm">Ventas <Cobertura estado={cobertura.estado_ventas} /></span>
        <span className="text-sm">Clientes <Cobertura estado={cobertura.estado_clientes} /></span>
      </div>
      {(cobertura.estado_clientes === "parcial" || cobertura.estado_clientes === "sin_identificar") &&
        <p className="text-sm text-slate-700">{numero(cobertura.pedidos_sin_cliente)} pedidos reconocidos sin cliente identificado.</p>}
      <Tabla titulo="Por facturación" columnas={["Cliente", "Facturación (CLP)", "Pedidos", "Participación verificada"]}
        filas={clientes.map((c) => ({
          id: c.cliente_id,
          celdas: [
            c.nombre_cliente_actual === null ? "Cliente sin ficha disponible" : <EnlaceAdmin href={`/admin/clientes/${c.cliente_id}`}>{c.nombre_cliente_actual}</EnlaceAdmin>,
            clp(c.facturacion_clp), numero(c.pedidos), participacion(c.participacion_ventas_verificadas),
          ],
        }))}
        pie={pieRanking(clientes.length, rankings.facturacion.candidatos)} vacio="Sin clientes identificados con ventas verificadas para este ranking." />
      <details className="border-t border-slate-100 pt-3">
        <summary className="cursor-pointer text-sm font-semibold text-emerald-900">Ver frecuencia de compra</summary>
        <div className="mt-3">
          <Tabla titulo="Frecuencia de compra" columnas={["Cliente", "Pedidos por día civil", "Base"]}
            filas={frecuentes.map((c) => {
              const frecuencia = c.frecuencia_pedidos_por_dia_civil;
              return {
                id: c.cliente_id,
                celdas: [
                  c.nombre_cliente_actual === null ? "Cliente sin ficha disponible" : <EnlaceAdmin href={`/admin/clientes/${c.cliente_id}`}>{c.nombre_cliente_actual}</EnlaceAdmin>,
                  numero(frecuencia?.valor ?? null),
                  frecuencia ? `${numero(frecuencia.numerador)} pedidos en ${numero(frecuencia.denominador)} días` : "No disponible",
                ],
              };
            })}
            pie={`${pieRanking(frecuentes.length, rankings.frecuencia.candidatos)} con al menos dos pedidos reconocidos.`}
            vacio="Sin clientes elegibles con al menos dos pedidos reconocidos en el período." />
        </div>
      </details>
      <div className="space-y-2 border-t border-slate-100 pt-3">
        <h3 className="font-semibold">Concentración comercial</h3>
        {concentracion.estado === "evaluable" ? (
          <>
            <dl className="grid gap-3 sm:grid-cols-2">
              <Metrica titulo="Cliente líder" valor={participacion(concentracion.participacion_primer_cliente)} />
              <Metrica titulo="Primeros cinco clientes" valor={participacion(concentracion.participacion_primeros_cinco)} />
            </dl>
            <p className="text-xs text-slate-600">{numero(concentracion.clientes_recurrentes)} de {numero(concentracion.clientes_identificados)} clientes identificados hicieron al menos dos pedidos reconocidos.</p>
          </>
        ) : (
          <div className="space-y-2 text-sm text-slate-700">
            <Cobertura estado={concentracion.estado} />
            <p>{actual.cerrado ? "La cobertura o el volumen del período no alcanzan los mínimos requeridos." : "El período sigue abierto. La concentración se evalúa en períodos cerrados."}</p>
          </div>
        )}
      </div>
      <EnlaceAdmin href="/admin/clientes">Ir a clientes</EnlaceAdmin>
    </Panel>
  );
}

export function RankingsComerciales({ datos }: { datos: RankingsDashboard | null }) {
  const actual = datos?.periodos.actual;
  if (!actual) return <Panel id="rankings" titulo="Rankings comerciales"><ErrorFuente /></Panel>;
  const cobertura = actual.cobertura;
  return (
    <section id="rankings" tabIndex={-1} aria-label="Rankings comerciales" className="scroll-mt-24 space-y-4">
      {(cobertura.estado_ventas === "parcial" || cobertura.estado_ventas === "sin_evidencia") && (
        <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-950">
          Los rankings muestran la evidencia disponible. Hay {numero(cobertura.entregados_sin_evidencia_suficiente)} entregas sin evidencia suficiente y{" "}
          {numero(cobertura.pedidos_con_correccion_no_verificada)} pedidos con correcciones sin verificar.
        </p>
      )}
      <div className="grid items-start gap-4 xl:grid-cols-2"><Productos actual={actual} /><Clientes actual={actual} /></div>
    </section>
  );
}

const temas = {
  variacion_facturacion: "Facturación reconocida",
  variacion_concentracion: "Concentración del cliente líder",
  variacion_recurrencia: "Recurrencia de compra",
} as const;

function baseRecurrencia(fraccion: FraccionDashboard) {
  return `${numero(fraccion.numerador)} de ${numero(fraccion.denominador)} clientes identificados`;
}

export function ConclusionesComerciales({ datos, lecturasDiscrepan }: {
  datos: RankingsDashboard | null; lecturasDiscrepan: boolean;
}) {
  return (
    <Panel id="conclusiones" titulo="Conclusiones del período" descripcion="Reglas de la RPC aplicadas al período seleccionado y al anterior.">
      {lecturasDiscrepan ? (
        <p className="text-sm text-slate-700">Conclusiones pendientes de una lectura coherente de ventas y rankings.</p>
      ) : datos ? (
        <>
          {datos.conclusiones.length > 0 && (
            <ul className="grid gap-3 lg:grid-cols-3">
              {datos.conclusiones.map((item) => {
                const evidencia = item.codigo === "variacion_facturacion"
                  ? `De ${clp(item.evidencia.anterior_clp)} en ${numero(item.evidencia.pedidos_anterior)} pedidos a ${clp(item.evidencia.actual_clp)} en ${numero(item.evidencia.pedidos_actual)} pedidos.`
                  : item.codigo === "variacion_concentracion"
                    ? `Período anterior ${participacion(item.evidencia.anterior)}. Período seleccionado ${participacion(item.evidencia.actual)}.`
                    : `De ${baseRecurrencia(item.evidencia.anterior)} a ${baseRecurrencia(item.evidencia.actual)} con dos o más pedidos reconocidos.`;
                return (
                  <li key={item.codigo} className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
                    <h3 className="font-semibold text-emerald-950">{item.hecho}</h3>
                    <p className="mt-2 text-sm text-slate-700">{evidencia}</p>
                    <p className="mt-2 text-sm text-slate-700"><strong>Oportunidad.</strong> {item.oportunidad}</p>
                  </li>
                );
              })}
            </ul>
          )}
          <ul className="space-y-1 text-sm text-slate-700">
            {(Object.keys(temas) as (keyof typeof temas)[]).map((codigo) => {
              const estado = datos.estado_conclusiones[codigo];
              return estado === "emitida" ? null : (
                <li key={codigo}><strong>{temas[codigo]}</strong> · {estado === "informacion_insuficiente" ? "Información insuficiente para evaluar." : "Cambio por debajo del umbral de la regla."}</li>
              );
            })}
          </ul>
        </>
      ) : <ErrorFuente />}
    </Panel>
  );
}
