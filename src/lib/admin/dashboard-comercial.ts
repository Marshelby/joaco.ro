import "server-only";
import { z } from "zod";

import type { PeriodoDashboard } from "@/lib/admin/dashboard-periodo";
import { exigirSesionAdmin } from "@/lib/admin/sesion";
import { esFechaCalendario, leerInstante } from "@/lib/operational-date";

// Contratos v1 de supabase/manual. Los importes,
// conteos y cocientes llegan como texto decimal de PostgreSQL.
const decimal = z.string().regex(/^-?\d+(?:\.\d+)?$/);
const conteo = z.string().regex(/^\d+$/);
const diferenciaConteo = z.string().regex(/^-?\d+$/);
const fecha = z.string().refine(esFechaCalendario);
const instante = z.string().refine((valor) => Number.isFinite(leerInstante(valor)));
const limites = z.object({ desde: fecha, hasta: fecha, desde_utc: instante, hasta_utc_exclusivo: instante });
const estadoVentas = z.enum(["completa", "parcial", "sin_evidencia", "sin_ventas"]);
const estadoIdentidad = z.enum(["completa", "parcial", "sin_ventas_reconocidas", "sin_identificar"]);
const evaluacion = z.enum(["evaluable", "informacion_insuficiente"]);
const fraccion = z.object({ valor: decimal, numerador: decimal, denominador: decimal });
const pago = z.object({ registros: conteo, importe_nominal_clp: decimal });
const encabezado = z.object({
  version: z.literal(1), moneda: z.literal("CLP"), zona_horaria: z.literal("America/Santiago"), leido_en: instante,
});

const ventaPeriodo = limites.extend({
  pedidos_creados: conteo,
  ventas_reconocidas_clp: decimal.nullable(),
  pedidos_con_venta_reconocida: conteo,
  compradores_identificados: conteo,
  ticket_promedio: z.object({ valor_clp: decimal, numerador_clp: decimal, denominador_pedidos: conteo }).nullable(),
  cobertura: z.object({
    estado_ventas: estadoVentas,
    estado_compradores: estadoIdentidad,
    pedidos_sin_comprador_identificado: conteo,
    entregados_sin_evidencia_suficiente: conteo,
    pedidos_con_correccion_posterior_no_verificada: conteo,
    registros_excluidos: conteo, excluidos_por_motivo: z.record(z.string(), conteo),
  }),
});
const ventas = encabezado.extend({ periodos: z.object({ actual: ventaPeriodo, anterior: ventaPeriodo }) });

const finanzasPeriodo = limites.extend({
  pagos_registrados: pago.extend({
    estado_cobertura: z.literal("completa_para_filas_existentes"),
    fecha_fuente: z.literal("pagos.fecha_creacion"),
    incluye_reemplazos_contables: z.literal(true),
    por_estado_actual: z.record(z.string(), pago),
  }),
  pagos_aplicados: z.object({
    estado_cobertura: z.literal("informacion_no_disponible"), importe_clp: z.null(), motivo: z.string(),
  }),
  cobranza: z.object({
    estado_cobertura: z.literal("cobertura_insuficiente"), total_recibido_clp: z.null(), denominador_recepciones_totales: z.null(), motivo: z.string(),
    cobertura_entregas_definitivas: z.object({
      fecha_cohorte: z.literal("entregas_definitivas.instante"),
      entregas_definitivas: conteo, entregas_con_registro_de_cobro: conteo, entregas_sin_registro_de_cobro: conteo,
    }),
    entregas: z.object({
      fecha_fuente: z.literal("cobros_entrega.fecha"),
      estado_evidencia: z.enum(["sin_registros", "con_registros"]), registros_con_evidencia: conteo,
      registros_con_recepcion: conteo, registros_sin_recepcion: conteo, subtotal_bruto_original_clp: decimal.nullable(),
    }),
  }),
});
const finanzas = encabezado.extend({
  periodos: z.object({ actual: finanzasPeriodo, anterior: finanzasPeriodo }),
  saldos_actuales: z.object({
    cuentas_corrientes: z.object({
      alcance: z.literal("cuentas_de_clientes_identificados"),
      clientes_evaluados: conteo, clientes_con_movimientos: conteo, cargos_clp: decimal, abonos_clp: decimal, clientes_deudores: conteo, clientes_con_saldo_a_favor: conteo,
      deuda_vigente_clp: decimal, saldo_a_favor_clp: decimal,
      ranking_deuda: z.object({
        limite: conteo, clientes_incluidos: conteo, clientes_deudores_totales: conteo,
        clientes: z.array(z.object({ cliente_id: z.guid(), nombre_cliente: z.string().nullable(), deuda_clp: decimal })),
      }),
    }),
    pagos_confirmados: z.object({
      registros: conteo, registros_con_aplicaciones: conteo, registros_con_disponible: conteo,
      importe_confirmado_clp: decimal, importe_aplicado_a_pedidos_clp: decimal,
      credito_disponible_sin_aplicar_clp: decimal,
    }),
  }),
});

const producto = z.object({
  producto_id: z.guid(), nombre_producto_snapshot: z.string().nullable(), facturacion_lineas_clp: decimal,
  pedidos_con_entrega: conteo, kg_fraccionables_documentados: decimal.nullable(), lineas_kg_fraccionable: conteo,
  participacion_subtotal_lineas_verificadas: fraccion.nullable(),
});
const cliente = z.object({
  cliente_id: z.guid(), nombre_cliente_actual: z.string().nullable(), facturacion_clp: decimal, pedidos: conteo,
  ticket_promedio_clp: fraccion.nullable(), frecuencia_pedidos_por_dia_civil: fraccion.nullable(),
  participacion_ventas_verificadas: fraccion.nullable(),
});
const listaProductos = z.object({ candidatos: conteo, filas: z.array(producto) });
const listaClientes = z.object({ candidatos: conteo, filas: z.array(cliente) });
const rankingPeriodo = limites.extend({
  cerrado: z.boolean(),
  ventas_reconocidas_clp: decimal.nullable(), pedidos_con_venta_reconocida: conteo,
  pedidos_con_venta_reconocida_positiva: conteo, subtotal_lineas_verificadas_clp: decimal.nullable(),
  cobertura: z.object({
    estado_ventas: estadoVentas,
    estado_clientes: estadoIdentidad,
    estado_productos: z.enum(["completa", "parcial", "sin_ventas_reconocidas"]),
    estado_kg: z.enum(["completa", "subconjunto_documentado", "sin_kg_comparables_documentados"]),
    pedidos_sin_lineas_verificadas: conteo, pedidos_con_lineas_verificadas: conteo,
    pedidos_sin_cliente: conteo, facturacion_sin_cliente_clp: decimal,
    lineas_sin_producto: conteo, subtotal_sin_producto_clp: decimal,
    lineas_con_cantidad_desconocida: conteo, lineas_con_cantidad_cero_e_importe_positivo: conteo,
    lineas_entregadas_fuera_de_kg_fraccionable_documentado: conteo,
    excluidos_por_motivo: z.record(z.string(), conteo),
    disponibilidad_historica: z.literal("informacion_no_disponible"),
    entregados_sin_evidencia_suficiente: conteo, pedidos_con_correccion_no_verificada: conteo,
  }),
  rankings_productos: z.object({ facturacion: listaProductos, pedidos: listaProductos, kg_fraccionables_documentados: listaProductos }),
  rankings_clientes: z.object({ facturacion: listaClientes, pedidos: listaClientes, ticket_promedio: listaClientes, frecuencia: listaClientes }),
  productos_con_pocas_ventas_observadas: listaProductos.extend({ estado: evaluacion }),
  concentracion_clientes: z.object({
    estado: evaluacion, clientes_identificados: conteo, clientes_recurrentes: conteo,
    participacion_primer_cliente: fraccion.nullable(), participacion_primeros_cinco: fraccion.nullable(),
  }),
});
const hecho = z.object({ hecho: z.string(), oportunidad: z.string() });
const proporcion = z.object({ actual: fraccion, anterior: fraccion });
const conclusion = z.discriminatedUnion("codigo", [
  hecho.extend({
    codigo: z.literal("variacion_facturacion"),
    evidencia: z.object({ actual_clp: decimal, anterior_clp: decimal, pedidos_actual: conteo, pedidos_anterior: conteo }),
  }),
  hecho.extend({ codigo: z.literal("variacion_concentracion"), evidencia: proporcion.extend({ clientes_actual: conteo, clientes_anterior: conteo }) }),
  hecho.extend({ codigo: z.literal("variacion_recurrencia"), evidencia: proporcion }),
]);
const estadoConclusion = z.enum(["emitida", "sin_cambio_material", "informacion_insuficiente"]);
const rankings = encabezado.extend({
  dias_civiles_por_periodo: z.number().int().min(1).max(366),
  limite_por_ranking: z.number().int().positive(),
  umbrales: z.object({
    min_pedidos_por_periodo: z.number().int(), min_clientes_por_periodo: z.number().int(),
    min_pedidos_positivos_para_comparacion_y_concentracion: z.number().int(),
    max_pedidos_producto_poca_venta: z.number().int(), min_pedidos_ticket_y_frecuencia: z.number().int(),
    min_pedidos_cliente_recurrente: z.number().int(), cambio_relativo_minimo_facturacion: decimal,
    cambio_absoluto_minimo_proporciones: decimal,
  }),
  periodos: z.object({ actual: rankingPeriodo, anterior: rankingPeriodo }),
  comparacion: z.object({
    estado_ventas: evaluacion, estado_clientes: evaluacion,
    diferencia_facturacion_clp: decimal.nullable(), diferencia_pedidos: diferenciaConteo.nullable(),
  }),
  estado_conclusiones: z.object({
    variacion_facturacion: estadoConclusion, variacion_concentracion: estadoConclusion, variacion_recurrencia: estadoConclusion,
  }),
  conclusiones: z.array(conclusion).max(3),
});

export type VentasDashboard = z.infer<typeof ventas>;
export type FinanzasDashboard = z.infer<typeof finanzas>;
export type RankingsDashboard = z.infer<typeof rankings>;
export type FraccionDashboard = z.infer<typeof fraccion>;

type Respuesta = { periodos: { actual: z.infer<typeof limites>; anterior: z.infer<typeof limites> } };
type Fuente = "ventas" | "finanzas" | "rankings";

export async function leerDashboardComercial(periodo: PeriodoDashboard) {
  const supabase = await exigirSesionAdmin();
  const args = { p_desde: periodo.desde, p_hasta: periodo.hasta };

  async function leer<T extends Respuesta>(fuente: Fuente, contrato: z.ZodType<T>): Promise<T | null> {
    try {
      const { data, error } = await supabase.rpc(`leer_dashboard_comercial_${fuente}_admin`, args);
      if (error) return null;
      const resultado = contrato.safeParse(data);
      if (!resultado.success) return null;
      const { actual, anterior } = resultado.data.periodos;
      if (actual.desde !== periodo.desde || actual.hasta !== periodo.hasta ||
          anterior.desde !== periodo.anteriorDesde || anterior.hasta !== periodo.anteriorHasta) return null;
      if (leerInstante(anterior.desde_utc) >= leerInstante(anterior.hasta_utc_exclusivo) ||
          leerInstante(actual.desde_utc) >= leerInstante(actual.hasta_utc_exclusivo) ||
          leerInstante(anterior.hasta_utc_exclusivo) !== leerInstante(actual.desde_utc)) return null;
      return resultado.data;
    } catch {
      return null;
    }
  }

  const [ventasDatos, finanzasDatos, rankingsDatos] = await Promise.all([
    leer("ventas", ventas), leer("finanzas", finanzas), leer("rankings", rankings),
  ]);
  return { ventas: ventasDatos, finanzas: finanzasDatos, rankings: rankingsDatos };
}
