import type { FinanzasDashboard, RankingsDashboard, VentasDashboard } from "@/lib/admin/dashboard-comercial";
import { formatDateTimeCL } from "@/lib/formatters";

import { clp, Cobertura, EnlaceAdmin, ErrorFuente, Metrica, numero, Panel, Tabla } from "./piezas";

export function VentasComerciales({ datos, comparacion }: {
  datos: VentasDashboard | null; comparacion?: RankingsDashboard["comparacion"];
}) {
  const actual = datos?.periodos.actual;
  const anterior = datos?.periodos.anterior;
  return (
    <Panel id="ventas" titulo="Ventas reconocidas" descripcion="Importes respaldados por evidencia de entrega o corrección verificable.">
      {actual && anterior ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Cobertura estado={actual.cobertura.estado_ventas} />
            {(actual.cobertura.estado_ventas === "parcial" || actual.cobertura.estado_ventas === "sin_evidencia") && (
              <p className="text-sm text-slate-700">
                {numero(actual.cobertura.entregados_sin_evidencia_suficiente)} entregas sin evidencia suficiente y{" "}
                {numero(actual.cobertura.pedidos_con_correccion_posterior_no_verificada)} pedidos con correcciones posteriores sin verificar.
              </p>
            )}
          </div>
          <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metrica titulo="Importe reconocido" valor={clp(actual.ventas_reconocidas_clp)} />
            <Metrica titulo="Pedidos con venta reconocida" valor={numero(actual.pedidos_con_venta_reconocida)} />
            <Metrica titulo="Compradores identificados" valor={numero(actual.compradores_identificados)}
              detalle={<><Cobertura estado={actual.cobertura.estado_compradores} /><span className="mt-1 block">{numero(actual.cobertura.pedidos_sin_comprador_identificado)} pedidos reconocidos sin comprador identificado</span></>} />
            <Metrica titulo="Ticket promedio" valor={clp(actual.ticket_promedio?.valor_clp ?? null)}
              detalle={actual.ticket_promedio && `${clp(actual.ticket_promedio.numerador_clp)} en ${numero(actual.ticket_promedio.denominador_pedidos)} pedidos reconocidos`} />
          </dl>
          <p className="text-sm text-slate-700"><EnlaceAdmin href="/admin/pedidos">Pedidos creados</EnlaceAdmin> · {numero(actual.pedidos_creados)} en el período seleccionado y {numero(anterior.pedidos_creados)} en el anterior.</p>
          <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
            <h3 className="font-semibold">Comparación con el período anterior</h3>
            <p className="mt-1">{comparacion?.estado_ventas === "evaluable" && actual.cobertura.estado_ventas === "completa" && anterior.cobertura.estado_ventas === "completa"
              ? `Variación del importe reconocido ${clp(comparacion.diferencia_facturacion_clp)} · Variación de pedidos reconocidos ${numero(comparacion.diferencia_pedidos)}.`
              : comparacion ? "Información insuficiente para comparar ventas reconocidas." : "Comparación no disponible."}</p>
            <p className="mt-1 flex flex-wrap items-center gap-2">
              Importe anterior {clp(anterior.ventas_reconocidas_clp)} <Cobertura estado={anterior.cobertura.estado_ventas} />
            </p>
          </div>
        </>
      ) : <ErrorFuente />}
    </Panel>
  );
}

const estadosPago: Record<string, string> = {
  registrado: "Registrado", pendiente_verificacion: "Pendiente de verificación", confirmado: "Confirmado", anulado: "Anulado",
};

export function FinanzasComerciales({ datos }: { datos: FinanzasDashboard | null }) {
  const cuentas = datos?.saldos_actuales.cuentas_corrientes;
  const flujo = datos?.periodos.actual;
  const ranking = cuentas?.ranking_deuda;
  return (
    <>
      <Panel id="saldos" titulo="Cuentas corrientes" descripcion={datos ? `Saldos vigentes de clientes identificados al ${formatDateTimeCL(datos.leido_en)} · independientes del período seleccionado.` : undefined}>
        {cuentas && ranking ? (
          <>
            <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <Metrica titulo="Deuda vigente" valor={clp(cuentas.deuda_vigente_clp)} />
              <Metrica titulo="Clientes deudores" valor={numero(cuentas.clientes_deudores)} detalle={`De ${numero(cuentas.clientes_evaluados)} clientes evaluados`} />
              <Metrica titulo="Saldos a favor" valor={clp(cuentas.saldo_a_favor_clp)} detalle={`${numero(cuentas.clientes_con_saldo_a_favor)} clientes con saldo a favor`} />
            </dl>
            <details>
              <summary className="cursor-pointer text-sm font-semibold text-emerald-900">Ver ranking de deuda</summary>
              <div className="mt-3">
                <Tabla titulo="Mayores saldos deudores" columnas={["Cliente", "Deuda vigente"]}
                  filas={ranking.clientes.map((c) => ({
                    id: c.cliente_id,
                    celdas: [<EnlaceAdmin href={`/admin/clientes/${c.cliente_id}`}>{c.nombre_cliente ?? "Cliente sin nombre disponible"}</EnlaceAdmin>, clp(c.deuda_clp)],
                  }))}
                  pie={`${numero(ranking.clientes_incluidos)} de ${numero(ranking.clientes_deudores_totales)} clientes deudores`}
                  vacio="Sin clientes deudores en las cuentas evaluadas." />
              </div>
            </details>
          </>
        ) : <ErrorFuente />}
      </Panel>
      <Panel id="pagos" titulo="Pagos y evidencia de recepción" descripcion="Información del período seleccionado.">
        {flujo ? (
          <>
            <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <Metrica titulo="Pagos registrados · importe nominal" valor={clp(flujo.pagos_registrados.importe_nominal_clp)}
                detalle={`${numero(flujo.pagos_registrados.registros)} filas por fecha de creación. Cobertura completa para filas existentes. Incluye reemplazos contables.`} />
              <Metrica titulo="Dinero efectivamente recibido · total" valor={clp(flujo.cobranza.total_recibido_clp)}
                detalle={<><Cobertura estado={flujo.cobranza.estado_cobertura} /><span className="mt-1 block">{flujo.cobranza.motivo}</span></>} />
              <Metrica titulo="Cobros documentados al entregar · bruto original" valor={clp(flujo.cobranza.entregas.subtotal_bruto_original_clp)}
                detalle={flujo.cobranza.entregas.estado_evidencia === "sin_registros" ? "Sin registros de cobro al entregar en el período."
                  : `Subconjunto por fecha de registro del cobro. ${numero(flujo.cobranza.entregas.registros_con_recepcion)} de ${numero(flujo.cobranza.entregas.registros_con_evidencia)} registros documentan recepción.`} />
            </dl>
            <p className="text-sm text-slate-700">
              Por fecha de entrega definitiva, {numero(flujo.cobranza.cobertura_entregas_definitivas.entregas_con_registro_de_cobro)} de{" "}
              {numero(flujo.cobranza.cobertura_entregas_definitivas.entregas_definitivas)} entregas tienen registro de cobro.
            </p>
            <details>
              <summary className="cursor-pointer text-sm font-semibold text-emerald-900">Ver desglose contable de pagos</summary>
              <div className="mt-3">
                <Tabla titulo="Registros por estado actual" columnas={["Estado", "Registros", "Importe nominal"]}
                  filas={Object.entries(flujo.pagos_registrados.por_estado_actual).map(([estado, pago]) => ({
                    id: estado, celdas: [estadosPago[estado] ?? estado, numero(pago.registros), clp(pago.importe_nominal_clp)],
                  }))} pie="Estados vigentes de los registros creados durante el período." vacio="Sin filas de pago creadas en el período." />
              </div>
            </details>
            <p className="text-sm text-slate-700"><strong>Pagos aplicados en el período</strong> · {clp(flujo.pagos_aplicados.importe_clp)}. {flujo.pagos_aplicados.motivo}</p>
          </>
        ) : <ErrorFuente />}
        <p className="border-t border-slate-100 pt-3 text-sm text-slate-700"><strong>Rentabilidad</strong> · No disponible. Las RPC del dashboard no entregan costos ni márgenes.</p>
      </Panel>
    </>
  );
}
