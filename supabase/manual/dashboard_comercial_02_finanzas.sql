-- Instalación manual. Requiere el núcleo y la cadena contable hasta
-- 20261108170000 con sus dependencias. Independiente de la Fase 3.1.
begin;
set local search_path = pg_catalog;

-- Misma base que v_saldos_cuenta_clientes. Se agregan los movimientos sin
-- consumir saldo_acumulado ni estrechar los totales por cliente a bigint.
-- La corrección de una venta entregada entra por su ajuste de cuenta.
-- v_saldos_pedidos ya incorpora la diferencia al total del pedido y se usa
-- en la imputación operativa. Sus saldos no se suman a la cuenta corriente.
create or replace view operativo_privado.dashboard_comercial_cuentas_actuales
with (security_invoker = true)
as
select c.id as cliente_id,
       c.nombre as nombre_cliente,
       count(m.referencia_id) as movimientos,
       coalesce(sum(m.cargo), 0) as cargos_clp,
       coalesce(sum(m.abono), 0) as abonos_clp,
       coalesce(sum(m.movimiento_neto), 0) as saldo_clp
from public.clientes c
left join public.v_movimientos_cuenta_cliente m on m.cliente_id = c.id
group by c.id, c.nombre;

-- Evidencia de recepción original bruta. Una fila por entrega, incluso
-- cuando hay dos medios de pago. Una anulación o reemplazo posterior
-- puede cambiar el libro actual, pero no reescribe esta evidencia.
create or replace view operativo_privado.dashboard_comercial_cobros_entrega
with (security_invoker = true)
as
select c.pedido_id, c.fecha as registrado_en, c.recibido as recibido_clp
from operativo_privado.cobros_entrega c;

alter view operativo_privado.dashboard_comercial_cuentas_actuales owner to postgres;
alter view operativo_privado.dashboard_comercial_cobros_entrega owner to postgres;
revoke all on operativo_privado.dashboard_comercial_cuentas_actuales,
  operativo_privado.dashboard_comercial_cobros_entrega
  from public, anon, authenticated, service_role;

create or replace function public.leer_dashboard_comercial_finanzas_admin(
  p_desde date, p_hasta date
)
returns jsonb
language plpgsql stable security definer
set search_path = pg_catalog
set row_security = off
set timezone = 'UTC'
set datestyle = 'ISO, YMD'
as $$
declare
  v_fecha_minima constant date := date '0001-01-01';
  v_fin_exclusivo_maximo constant date := date '9999-12-31';
  v_max_dias constant integer := 366;
  v_limite_ranking constant integer := 20;
  v_dias integer;
  v_resultado jsonb;
begin
  if auth.uid() is null or not coalesce(public.es_admin(), false) then
    raise exception 'NO_AUTORIZADO' using errcode = '42501';
  end if;

  if p_desde is null or p_hasta is null
    or not isfinite(p_desde) or not isfinite(p_hasta)
    or p_desde < v_fecha_minima or p_hasta >= v_fin_exclusivo_maximo
    or p_desde > p_hasta then
    raise exception 'PERIODO_INVALIDO' using errcode = '22023';
  end if;
  v_dias := p_hasta - p_desde + 1;
  if v_dias > v_max_dias then
    raise exception 'PERIODO_INVALIDO' using errcode = '22023';
  end if;
  if p_desde - v_fecha_minima < v_dias then
    raise exception 'PERIODO_ANTERIOR_INVALIDO' using errcode = '22023';
  end if;

  with cuentas as materialized (
    select * from operativo_privado.dashboard_comercial_cuentas_actuales
  ), resumen_cuentas as (
    select count(*) as clientes,
           count(*) filter (where movimientos > 0) as clientes_con_movimientos,
           count(*) filter (where saldo_clp > 0) as deudores,
           count(*) filter (where saldo_clp < 0) as acreedores,
           coalesce(sum(saldo_clp) filter (where saldo_clp > 0), 0) as deuda,
           coalesce(sum(-saldo_clp) filter (where saldo_clp < 0), 0) as saldo_favor,
           coalesce(sum(cargos_clp), 0) as cargos,
           coalesce(sum(abonos_clp), 0) as abonos
    from cuentas
  ), ranking as (
    select coalesce(jsonb_agg(
      jsonb_build_object('cliente_id', cliente_id, 'nombre_cliente', nombre_cliente,
                         'deuda_clp', saldo_clp::text)
      order by saldo_clp desc, cliente_id
    ), '[]'::jsonb) as filas, count(*) as cantidad
    from (
      select cliente_id, nombre_cliente, saldo_clp
      from cuentas
      where saldo_clp > 0
      order by saldo_clp desc, cliente_id
      limit v_limite_ranking
    ) primeros
  ), pagos_vigentes as (
    select count(*) as cantidad,
           count(*) filter (where monto_aplicado > 0) as con_aplicaciones,
           count(*) filter (where monto_disponible > 0) as con_disponible,
           coalesce(sum(monto_pago), 0) as confirmado,
           coalesce(sum(monto_aplicado), 0) as aplicado,
           coalesce(sum(monto_disponible), 0) as disponible
    from public.v_saldos_pagos
    where estado = 'confirmado'
  ), fechas as (
    select *
    from (values
      ('actual', p_desde, p_hasta + 1),
      ('anterior', p_desde - v_dias, p_desde)
    ) f(periodo, desde, hasta_exclusivo)
  ), limites as (
    select f.*,
           f.desde::timestamp at time zone 'America/Santiago' as desde_utc,
           f.hasta_exclusivo::timestamp at time zone 'America/Santiago' as hasta_utc
    from fechas f
  ), periodos as (
    select l.periodo, jsonb_build_object(
      'desde', l.desde,
      'hasta', l.hasta_exclusivo - 1,
      'desde_utc', l.desde_utc,
      'hasta_utc_exclusivo', l.hasta_utc,
      'pagos_registrados', jsonb_build_object(
        'estado_cobertura', 'completa_para_filas_existentes',
        'fecha_fuente', 'pagos.fecha_creacion',
        'registros', registros.cantidad::text,
        'importe_nominal_clp', registros.importe_clp::text,
        'por_estado_actual', registros.por_estado_actual,
        'incluye_reemplazos_contables', true
      ),
      'pagos_aplicados', jsonb_build_object(
        'estado_cobertura', 'informacion_no_disponible',
        'importe_clp', null,
        'motivo', 'Las filas de aplicación conservan vigencia actual y pueden ser corregidas o reasignadas. Falta una serie completa de sus cambios.'
      ),
      'cobranza', jsonb_build_object(
        'estado_cobertura', 'cobertura_insuficiente',
        'total_recibido_clp', null,
        'denominador_recepciones_totales', null,
        'motivo', 'La evidencia cubre recepciones registradas al entregar. Las recepciones administrativas y los flujos de devoluciones carecen de cobertura integral.',
        'cobertura_entregas_definitivas', jsonb_build_object(
          'fecha_cohorte', 'entregas_definitivas.instante',
          'entregas_definitivas', cohorte.total::text,
          'entregas_con_registro_de_cobro', cohorte.con_evidencia::text,
          'entregas_sin_registro_de_cobro', (cohorte.total - cohorte.con_evidencia)::text
        ),
        'entregas', jsonb_build_object(
          'fecha_fuente', 'cobros_entrega.fecha',
          'estado_evidencia', case
            when entregas.registros = 0 then 'sin_registros'
            else 'con_registros'
          end,
          'registros_con_evidencia', entregas.registros::text,
          'registros_con_recepcion', entregas.con_recepcion::text,
          'registros_sin_recepcion', (entregas.registros - entregas.con_recepcion)::text,
          'subtotal_bruto_original_clp', entregas.bruto_clp::text
        )
      )
    ) as datos
    from limites l
    cross join lateral (
      select coalesce(sum(e.cantidad), 0) as cantidad,
             coalesce(sum(e.importe_clp), 0) as importe_clp,
             coalesce(jsonb_object_agg(e.estado, jsonb_build_object(
               'registros', e.cantidad::text, 'importe_nominal_clp', e.importe_clp::text
             )), '{}'::jsonb) as por_estado_actual
      from (
        select p.estado::text as estado, count(*) as cantidad, sum(p.monto) as importe_clp
        from public.pagos p
        where p.fecha_creacion >= l.desde_utc and p.fecha_creacion < l.hasta_utc
        group by p.estado
      ) e
    ) registros
    cross join lateral (
      -- Cohorte de entregas para medir cobertura documental. La fecha de
      -- entrega definitiva sólo determina el denominador de esta cohorte.
      select count(*) as total,
             count(c.pedido_id) as con_evidencia
      from operativo_privado.entregas_definitivas d
      left join operativo_privado.dashboard_comercial_cobros_entrega c
        on c.pedido_id = d.pedido_id
      where d.instante >= l.desde_utc and d.instante < l.hasta_utc
    ) cohorte
    cross join lateral (
      select count(*) as registros,
             count(*) filter (where c.recibido_clp > 0) as con_recepcion,
             sum(c.recibido_clp) as bruto_clp
      from operativo_privado.dashboard_comercial_cobros_entrega c
      where c.registrado_en >= l.desde_utc and c.registrado_en < l.hasta_utc
    ) entregas
  )
  select jsonb_build_object(
    'version', 1,
    'moneda', 'CLP',
    'zona_horaria', 'America/Santiago',
    'leido_en', statement_timestamp(),
    'saldos_actuales', jsonb_build_object(
      'cuentas_corrientes', jsonb_build_object(
        'alcance', 'cuentas_de_clientes_identificados',
        'clientes_evaluados', c.clientes::text,
        'clientes_con_movimientos', c.clientes_con_movimientos::text,
        'clientes_deudores', c.deudores::text,
        'clientes_con_saldo_a_favor', c.acreedores::text,
        'cargos_clp', c.cargos::text,
        'abonos_clp', c.abonos::text,
        'deuda_vigente_clp', c.deuda::text,
        'saldo_a_favor_clp', c.saldo_favor::text,
        'ranking_deuda', jsonb_build_object(
          'limite', v_limite_ranking::text,
          'clientes_incluidos', r.cantidad::text,
          'clientes_deudores_totales', c.deudores::text,
          'clientes', r.filas
        )
      ),
      'pagos_confirmados', jsonb_build_object(
        'registros', p.cantidad::text,
        'registros_con_aplicaciones', p.con_aplicaciones::text,
        'registros_con_disponible', p.con_disponible::text,
        'importe_confirmado_clp', p.confirmado::text,
        'importe_aplicado_a_pedidos_clp', p.aplicado::text,
        'credito_disponible_sin_aplicar_clp', p.disponible::text
      )
    ),
    'periodos', (select jsonb_object_agg(periodo, datos) from periodos)
  )
  into v_resultado
  from resumen_cuentas c
  cross join ranking r
  cross join pagos_vigentes p;

  return v_resultado;
end;
$$;

alter function public.leer_dashboard_comercial_finanzas_admin(date, date) owner to postgres;
revoke all on function public.leer_dashboard_comercial_finanzas_admin(date, date)
  from public, anon, authenticated, service_role;
grant execute on function public.leer_dashboard_comercial_finanzas_admin(date, date)
  to authenticated;

commit;
