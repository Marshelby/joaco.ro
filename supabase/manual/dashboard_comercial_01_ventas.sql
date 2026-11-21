-- Instalación manual. Requiere el núcleo y las migraciones de auditoría,
-- entrega definitiva y correcciones hasta 20261108170000, con sus dependencias.
begin;
set local search_path = pg_catalog;

create or replace view operativo_privado.dashboard_comercial_pedidos as
select p.id as pedido_id, p.fecha_creacion
from public.pedidos p;

-- Lee únicamente el importe definitivo y comprueba el cierre del snapshot
-- con las líneas persistidas. Las reglas de importe viven en las RPC de escritura.
create or replace function operativo_privado.importe_dashboard_comercial(p_snapshot jsonb)
returns numeric
language sql immutable strict
set search_path = pg_catalog
as $$
  select case
    when t.total between 0 and 9007199254740991
      and l.cantidad > 0 and l.cantidad = l.validas
      and l.cantidad = l.distintas
      and l.subtotal = t.subtotal
      and t.total = t.subtotal + t.despacho - t.descuento
    then t.total
  end
  from lateral (
    select
      case when jsonb_typeof(p_snapshot -> 'total') = 'number'
        and p_snapshot ->> 'total' ~ '^[0-9]{1,19}$'
        then (p_snapshot ->> 'total')::numeric end as total,
      case when jsonb_typeof(p_snapshot -> 'subtotal') = 'number'
        and p_snapshot ->> 'subtotal' ~ '^[0-9]{1,19}$'
        then (p_snapshot ->> 'subtotal')::numeric end as subtotal,
      case when jsonb_typeof(p_snapshot -> 'costo_entrega') = 'number'
        and p_snapshot ->> 'costo_entrega' ~ '^[0-9]{1,19}$'
        then (p_snapshot ->> 'costo_entrega')::numeric end as despacho,
      case when jsonb_typeof(p_snapshot -> 'descuento') = 'number'
        and p_snapshot ->> 'descuento' ~ '^[0-9]{1,19}$'
        then (p_snapshot ->> 'descuento')::numeric end as descuento
  ) t
  cross join lateral (
    select count(*) as cantidad,
           count(distinct x.linea ->> 'item_pedido_id') as distintas,
           count(x.importe) as validas,
           sum(x.importe) as subtotal
    from (
      select z.linea, case
        when jsonb_typeof(z.linea -> 'importe_definitivo') = 'number'
          and z.linea ->> 'importe_definitivo' ~ '^[0-9]{1,19}$'
        then (z.linea ->> 'importe_definitivo')::numeric
      end as importe
      from jsonb_array_elements(case
        when jsonb_typeof(p_snapshot -> 'productos') = 'array'
        then p_snapshot -> 'productos'
        else '[]'::jsonb
      end) z(linea)
    ) x
  ) l;
$$;

alter function operativo_privado.importe_dashboard_comercial(jsonb) owner to postgres;
revoke all on function operativo_privado.importe_dashboard_comercial(jsonb)
  from public, anon, authenticated, service_role;

create or replace view operativo_privado.dashboard_comercial_ventas as
select p.id as pedido_id,
       p.cliente_id,
       p.regimen_contable,
       p.estado,
       p.fecha_creacion,
       p.venta_reconocida_en,
       e.instante as entrega_definitiva_en,
       case when not vigencia.no_verificada then c.version end as version_correccion,
       coalesce(evidencia.motivo, case when vigencia.no_verificada
         then 'correccion_posterior_no_verificada'
       end) as motivo_exclusion,
       case when evidencia.motivo is null and not vigencia.no_verificada
         then coalesce(c.total, original.total)
       end as importe_clp,
       vigencia.no_verificada as correccion_no_verificada
from public.pedidos p
left join operativo_privado.entregas_definitivas e on e.pedido_id = p.id
cross join lateral (
  select operativo_privado.importe_dashboard_comercial(e.snapshot) as total,
         case when pg_input_is_valid(e.snapshot ->> 'confirmada_en', 'timestamptz')
           then (e.snapshot ->> 'confirmada_en')::timestamptz
         end as confirmada_en
) original
cross join lateral (
  select count(*) as eventos,
         max(h.version) as ultima_version,
         count(*) filter (where h.operacion = 'correccion_venta_entregada') as correcciones,
         count(*) filter (
           where h.version = e.version and h.clave_idempotencia = e.clave
             and h.actor_id = e.actor
             and h.operacion = 'entrega_' || (e.snapshot ->> 'tipo')
             and h.valores_nuevos -> 'venta_definitiva' = e.snapshot
         ) as entregas_verificadas
  from operativo_privado.historial_operativo h
  where h.pedido_id = p.id
) historial
left join operativo_privado.versiones_pedido vp on vp.pedido_id = p.id
cross join lateral (
  select case
    when p.estado = 'cancelado' then 'cancelado'
    when p.estado = 'entrega_fallida' then 'no_entregado'
    when p.estado is distinct from 'entregado' then 'pendiente_de_entrega'
    when p.regimen_contable = 'legado' then 'legado_sin_evidencia_definitiva'
    when p.regimen_contable is distinct from 'entrega_v1' then 'regimen_contable_no_compatible'
    when p.venta_reconocida_en is null then 'sin_instante_de_reconocimiento'
    when e.pedido_id is null then 'sin_entrega_definitiva'
    when e.instante is distinct from p.venta_reconocida_en
      or e.snapshot is distinct from p.venta_definitiva_snapshot
      then 'entrega_y_pedido_discrepan'
    when e.snapshot -> 'contrato' is distinct from '1'::jsonb
      or e.snapshot ->> 'regimen' is distinct from 'entrega_v1'
      or e.snapshot ->> 'moneda' is distinct from 'CLP'
      or e.snapshot ->> 'pedido_id' is distinct from p.id::text
      or e.snapshot -> 'cliente_id' is distinct from coalesce(to_jsonb(p.cliente_id), 'null'::jsonb)
      or e.snapshot ->> 'clave' is distinct from e.clave::text
      or e.snapshot -> 'version' is distinct from to_jsonb(e.version)
      or e.snapshot ->> 'actor_id' is distinct from e.actor::text
      or coalesce(e.snapshot ->> 'tipo', '') not in ('todo_correcto', 'hubo_diferencias')
      or original.confirmada_en is distinct from e.instante
      or original.total is null then 'snapshot_definitivo_invalido'
    -- Versiones positivas y únicas por pedido. El conteo y el máximo
    -- deben coincidir con el contador para probar la secuencia desde 1.
    when historial.entregas_verificadas <> 1
      or historial.ultima_version is distinct from vp.version
      or historial.eventos is distinct from vp.version
      then 'historial_operativo_no_verificado'
  end as motivo
) evidencia
cross join lateral (
  select count(*) as cantidad,
         count(*) filter (where verificadas.valida) as validas,
         max(verificadas.version) filter (where verificadas.es_ultima) as version,
         max(verificadas.total) filter (where verificadas.es_ultima) as total
  from (
    select cv.version, importe.total, cv.version = cv.ultima_version as es_ultima,
           evidencia.motivo is null
             and cv.cliente_id = p.cliente_id
             and cv.operacion_original = e.clave
             and cv.version_original = e.version
             and cv.version > e.version
             and cv.anteriores = cv.snapshot_previo
             and (cv.nuevos - array['productos', 'subtotal', 'total'])
                 = (e.snapshot - array['productos', 'subtotal', 'total'])
             and importe.total is not null
             and h.clave_idempotencia = cv.clave
             and h.actor_id = cv.actor_id
             and h.motivo = cv.motivo
             and h.valores_anteriores = cv.anteriores
             and h.valores_nuevos = cv.nuevos as valida
    from (
      select cv.*,
             lag(cv.nuevos, 1, e.snapshot) over (order by cv.version) as snapshot_previo,
             max(cv.version) over () as ultima_version
      from public.correcciones_venta_entregada cv
      where cv.pedido_id = p.id
    ) cv
    left join operativo_privado.historial_operativo h
      on h.pedido_id = cv.pedido_id and h.version = cv.version
      and h.operacion = 'correccion_venta_entregada'
    cross join lateral (
      select case when evidencia.motivo is null
        then operativo_privado.importe_dashboard_comercial(cv.nuevos)
      end as total
    ) importe
  ) verificadas
) c
cross join lateral (
  -- La correspondencia por versión es uno a uno. Los conteos también
  -- detectan eventos de corrección sin fila y filas sin evento.
  select c.cantidad <> c.validas or c.cantidad <> historial.correcciones as no_verificada
) vigencia;

alter view operativo_privado.dashboard_comercial_pedidos owner to postgres;
alter view operativo_privado.dashboard_comercial_ventas owner to postgres;
revoke all on operativo_privado.dashboard_comercial_pedidos,
  operativo_privado.dashboard_comercial_ventas
  from public, anon, authenticated, service_role;

-- Fechas civiles inclusivas. El período anterior tiene la misma cantidad de
-- días civiles (máximo 366). Los dos intervalos UTC son semiabiertos.
-- Montos y conteos en texto decimal. Para el ticket, el par suma/conteo
-- conserva la razón exacta, incluso cuando el cociente decimal es periódico.
-- El instante de lectura identifica esta consulta, sin semántica de «a fecha de».
create or replace function public.leer_dashboard_comercial_ventas_admin(
  p_desde date, p_hasta date
)
returns jsonb
language plpgsql stable security definer
-- Con FORCE RLS, fallar si el rol propietario pierde acceso a la lectura completa.
set search_path = pg_catalog
set row_security = off
set timezone = 'UTC'
set datestyle = 'ISO, YMD'
as $$
declare
  v_fecha_minima constant date := date '0001-01-01';
  v_fin_exclusivo_maximo constant date := date '9999-12-31';
  v_max_dias constant integer := 366;
  v_dias integer;
  v_desde_anterior date;
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
  v_desde_anterior := p_desde - v_dias;

  with fechas as (
    select *
    from (values
      ('actual', p_desde, p_hasta + 1),
      ('anterior', v_desde_anterior, p_desde)
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
      'pedidos_creados', creados.cantidad::text,
      -- Si hay entregados excluidos, cualquier suma de ventas reconocidas
      -- queda identificada como parcial por cobertura.estado_ventas.
      'ventas_reconocidas_clp', case
        when a.reconocidos = 0 and a.sin_evidencia > 0 then null
        else coalesce(a.importe_clp, 0)::text
      end,
      'pedidos_con_venta_reconocida', a.reconocidos::text,
      'compradores_identificados', a.compradores::text,
      'ticket_promedio', case when a.reconocidos > 0 then jsonb_build_object(
        -- Redondeo a centavos con aritmética entera exacta para montos no negativos.
        'valor_clp', (div(a.importe_clp * 200 + a.reconocidos, a.reconocidos::numeric * 2) * 0.01)::text,
        'numerador_clp', a.importe_clp::text,
        'denominador_pedidos', a.reconocidos::text
      ) end,
      'cobertura', jsonb_build_object(
        'estado_ventas', case
          when a.reconocidos = 0 and a.sin_evidencia > 0 then 'sin_evidencia'
          when a.sin_evidencia > 0 or a.correcciones_no_verificadas > 0 then 'parcial'
          when a.reconocidos = 0 then 'sin_ventas'
          else 'completa'
        end,
        'estado_compradores', case
          when a.reconocidos = 0 then 'sin_ventas_reconocidas'
          when a.sin_comprador = a.reconocidos then 'sin_identificar'
          when a.sin_comprador > 0 then 'parcial'
          else 'completa'
        end,
        'pedidos_sin_comprador_identificado', a.sin_comprador::text,
        'entregados_sin_evidencia_suficiente', a.sin_evidencia::text,
        'pedidos_con_correccion_posterior_no_verificada', a.correcciones_no_verificadas::text,
        'registros_excluidos', a.excluidos::text,
        'excluidos_por_motivo', a.por_motivo
      )
    ) as datos
    from limites l
    cross join lateral (
      select count(*) as cantidad
      from operativo_privado.dashboard_comercial_pedidos p
      where p.fecha_creacion >= l.desde_utc and p.fecha_creacion < l.hasta_utc
    ) creados
    cross join lateral (
      -- Una sola base de lectura para métricas y motivos. En ausencia de
      -- instante contable o definitivo, se usa creación sólo para cobertura.
      with registros as materialized (
        select v.cliente_id, v.estado, v.importe_clp, v.motivo_exclusion,
               v.correccion_no_verificada
        from operativo_privado.dashboard_comercial_ventas v
        where coalesce(v.venta_reconocida_en, v.entrega_definitiva_en, v.fecha_creacion) >= l.desde_utc
          and coalesce(v.venta_reconocida_en, v.entrega_definitiva_en, v.fecha_creacion) < l.hasta_utc
      ), motivos as (
        select r.motivo_exclusion, count(*) as cantidad
        from registros r
        where r.motivo_exclusion is not null
        group by r.motivo_exclusion
      )
      select sum(r.importe_clp) as importe_clp,
             count(r.importe_clp) as reconocidos,
             count(distinct r.cliente_id) filter (where r.importe_clp is not null) as compradores,
             count(*) filter (where r.importe_clp is not null and r.cliente_id is null) as sin_comprador,
             count(*) filter (where r.motivo_exclusion is not null and r.estado = 'entregado') as sin_evidencia,
             count(*) filter (where r.correccion_no_verificada) as correcciones_no_verificadas,
             count(*) filter (where r.motivo_exclusion is not null) as excluidos,
             coalesce((select jsonb_object_agg(m.motivo_exclusion, m.cantidad::text)
                       from motivos m), '{}'::jsonb) as por_motivo
      from registros r
    ) a
  )
  select jsonb_build_object(
    'version', 1,
    'moneda', 'CLP',
    'zona_horaria', 'America/Santiago',
    'leido_en', statement_timestamp(),
    'periodos', jsonb_object_agg(periodo, datos)
  )
  into v_resultado
  from periodos;

  return v_resultado;
end;
$$;

alter function public.leer_dashboard_comercial_ventas_admin(date, date) owner to postgres;
revoke all on function public.leer_dashboard_comercial_ventas_admin(date, date)
  from public, anon, authenticated, service_role;
grant execute on function public.leer_dashboard_comercial_ventas_admin(date, date)
  to authenticated;

commit;
