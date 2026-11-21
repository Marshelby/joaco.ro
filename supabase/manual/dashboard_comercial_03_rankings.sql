-- Instalación manual después de dashboard_comercial_01_ventas.sql y sus
-- dependencias. La fase 3.2 es compatible y no es una dependencia de lectura.
begin;
set local search_path = pg_catalog;

-- La fase 3.1 decide si existe venta y qué versión está verificada.
-- Una corrección inválida excluye el pedido completo según su contrato.
create or replace view operativo_privado.dashboard_comercial_rankings_ventas
with (security_invoker = true)
as
select v.pedido_id, v.cliente_id, v.estado, v.importe_clp, v.motivo_exclusion,
       v.correccion_no_verificada,
       coalesce(v.venta_reconocida_en, v.entrega_definitiva_en, v.fecha_creacion) as instante,
       case when v.importe_clp is not null then
         case when v.version_correccion is null then e.snapshot else c.nuevos end
       end as snapshot
from operativo_privado.dashboard_comercial_ventas v
left join operativo_privado.entregas_definitivas e
  on e.pedido_id = v.pedido_id and v.importe_clp is not null and v.version_correccion is null
left join public.correcciones_venta_entregada c
  on c.pedido_id = v.pedido_id and c.version = v.version_correccion and v.importe_clp is not null;

alter view operativo_privado.dashboard_comercial_rankings_ventas owner to postgres;
revoke all on operativo_privado.dashboard_comercial_rankings_ventas
  from public, anon, authenticated, service_role;

-- Fracción exacta con una representación decimal redondeada a dos lugares.
-- Numeradores no negativos y denominadores positivos, salvo ausencia de base.
create or replace function operativo_privado.fraccion_dashboard_comercial(p_num numeric, p_den numeric)
returns jsonb
language sql immutable strict
set search_path = pg_catalog
as $$
  select case when p_den > 0 then jsonb_build_object(
    'valor', (div(p_num * 200 + p_den, p_den * 2) * 0.01)::text,
    'numerador', p_num::text,
    'denominador', p_den::text
  ) end;
$$;

alter function operativo_privado.fraccion_dashboard_comercial(numeric, numeric) owner to postgres;
revoke all on function operativo_privado.fraccion_dashboard_comercial(numeric, numeric)
  from public, anon, authenticated, service_role;

create or replace function public.leer_dashboard_comercial_rankings_admin(p_desde date, p_hasta date)
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
  v_limite constant integer := 20;
  v_min_pedidos constant integer := 20;
  v_min_pedidos_positivos constant integer := 10;
  v_min_clientes constant integer := 10;
  v_max_pocos_pedidos constant integer := 2;
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
  if v_dias > 366 then
    raise exception 'PERIODO_INVALIDO' using errcode = '22023';
  end if;
  if p_desde - v_fecha_minima < v_dias then
    raise exception 'PERIODO_ANTERIOR_INVALIDO' using errcode = '22023';
  end if;

  with fechas(periodo, desde, hasta_exclusivo) as (
    values ('actual', p_desde, p_hasta + 1), ('anterior', p_desde - v_dias, p_desde)
  ), limites as (
    select f.*,
           f.desde::timestamp at time zone 'America/Santiago' as desde_utc,
           f.hasta_exclusivo::timestamp at time zone 'America/Santiago' as hasta_utc,
           f.hasta_exclusivo <= (statement_timestamp() at time zone 'America/Santiago')::date as cerrado
    from fechas f
  ), registros as materialized (
    -- Una lectura de reconocimiento para ambos períodos. Los pendientes y
    -- cancelados sólo llegan a los contadores de exclusión.
    select case when v.instante >= (p_desde::timestamp at time zone 'America/Santiago')
                then 'actual' else 'anterior' end as periodo, v.*
    from operativo_privado.dashboard_comercial_rankings_ventas v
    where v.instante >= ((p_desde - v_dias)::timestamp at time zone 'America/Santiago')
      and v.instante < ((p_hasta + 1)::timestamp at time zone 'America/Santiago')
  ), reconocidas as materialized (
    select r.periodo, r.pedido_id, r.cliente_id, r.instante, r.importe_clp, r.snapshot,
           -- Fase 3.1 ya validó los importes de este snapshot. Los joins
           -- recuperan la entrega original o la corrección por su clave única.
           (jsonb_typeof(r.snapshot -> 'productos') is not distinct from 'array') as lineas_verificadas
    from registros r
    where r.importe_clp is not null
  ), motivos as (
    select periodo, motivo_exclusion, count(*) as pedidos
    from registros
    where motivo_exclusion is not null
    group by periodo, motivo_exclusion
  ), ventas as (
    select l.periodo,
           count(r.importe_clp) as pedidos,
           count(*) filter (where r.importe_clp > 0) as pedidos_positivos,
           coalesce(sum(r.importe_clp), 0) as total_clp,
           count(r.pedido_id) filter (where r.estado = 'entregado' and r.importe_clp is null) as entregados_excluidos,
           count(r.pedido_id) filter (where r.correccion_no_verificada) as correcciones_no_verificadas,
           count(r.pedido_id) filter (where r.importe_clp is not null and r.cliente_id is null) as pedidos_sin_cliente,
           coalesce(sum(r.importe_clp) filter (where r.cliente_id is null), 0) as clp_sin_cliente
    from limites l
    left join registros r using (periodo)
    group by l.periodo
  ), lineas as materialized (
    select r.periodo, r.pedido_id, r.instante,
           case when j.linea ->> 'producto_id' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                then (j.linea ->> 'producto_id')::uuid end as producto_id,
           j.linea ->> 'item_pedido_id' as item_id,
           nullif(btrim(j.linea ->> 'nombre_producto'), '') as nombre,
           (j.linea ->> 'importe_definitivo')::numeric as clp,
           case when q.cantidad >= 0 then q.cantidad end as cantidad,
           coalesce(j.linea ->> 'modo_cantidad', case
             -- Todo correcto copia el modo nullable. La preparación y la
             -- corrección resuelven ese caso con estos datos del snapshot.
             when r.snapshot ->> 'tipo' = 'todo_correcto' then case
               when lower(coalesce(j.linea ->> 'nombre_presentacion', '')) ~ '(saco|malla|caja|paquete|docena)'
                 then 'presentacion_cerrada'
               when q.unidad = 'KG' then 'kg_fraccionable'
               else 'unidad'
             end
           end) as modo,
           q.unidad
    from reconocidas r
    cross join lateral jsonb_array_elements(
      case when r.lineas_verificadas then r.snapshot -> 'productos' else '[]'::jsonb end
    ) j(linea)
    cross join lateral (
      select case when jsonb_typeof(j.linea -> 'cantidad_entregada') = 'number'
                  then (j.linea ->> 'cantidad_entregada')::numeric end as cantidad,
             upper(btrim(j.linea ->> 'unidad') collate "C") as unidad
    ) q
  ), cobertura_lineas as (
    select periodo, sum(clp) as subtotal_clp,
           count(*) filter (where producto_id is null and (cantidad is distinct from 0 or clp > 0)) as lineas_sin_producto,
           coalesce(sum(clp) filter (where producto_id is null), 0) as clp_sin_producto,
           count(*) filter (where cantidad is null) as cantidades_desconocidas,
           count(*) filter (where cantidad = 0 and clp > 0) as lineas_cero_con_importe,
           count(*) filter (
             where cantidad > 0 and (modo = 'kg_fraccionable' and unidad = 'KG') is not true
           ) as lineas_fuera_de_kg
    from lineas
    group by periodo
  ), nombres_productos as (
    select distinct on (periodo, producto_id) periodo, producto_id, nombre
    from lineas
    where producto_id is not null and nombre is not null
      and (cantidad > 0 or clp > 0)
    order by periodo, producto_id, instante desc, pedido_id, item_id collate "C"
  ), productos as (
    select periodo, producto_id, sum(clp) as clp,
           count(distinct pedido_id) filter (where cantidad > 0) as pedidos,
           sum(cantidad) filter (where cantidad > 0 and modo = 'kg_fraccionable' and unidad = 'KG') as kg,
           count(*) filter (where cantidad > 0 and modo = 'kg_fraccionable' and unidad = 'KG') as lineas_kg
    from lineas
    where producto_id is not null and (cantidad > 0 or clp > 0)
    group by periodo, producto_id
  ), clientes as materialized (
    select r.periodo, r.cliente_id, sum(r.importe_clp) as clp, count(*) as pedidos
    from reconocidas r
    where r.cliente_id is not null
    group by r.periodo, r.cliente_id
  ), principales as (
    select c.*, row_number() over (partition by periodo order by clp desc, cliente_id) as posicion
    from clientes c
  ), resumen_clientes as (
    select periodo, count(*) as clientes,
           count(*) filter (where pedidos >= 2) as recurrentes,
           max(clp) filter (where posicion = 1) as primero_clp,
           sum(clp) filter (where posicion <= 5) as primeros_cinco_clp
    from principales
    group by periodo
  ), bases as (
    select l.*, v.pedidos, v.pedidos_positivos, v.total_clp, v.entregados_excluidos, v.correcciones_no_verificadas,
           v.pedidos_sin_cliente, v.clp_sin_cliente,
           coalesce(a.subtotal_clp, 0) as subtotal_clp,
           coalesce(a.lineas_sin_producto, 0) as lineas_sin_producto,
           coalesce(a.clp_sin_producto, 0) as clp_sin_producto,
           coalesce(a.cantidades_desconocidas, 0) as cantidades_desconocidas,
           coalesce(a.lineas_cero_con_importe, 0) as lineas_cero_con_importe,
           coalesce(a.lineas_fuera_de_kg, 0) as lineas_fuera_de_kg,
           coalesce(c.clientes, 0) as clientes, coalesce(c.recurrentes, 0) as recurrentes,
           c.primero_clp, c.primeros_cinco_clp,
           (select count(*) from reconocidas r
            where r.periodo = l.periodo and not r.lineas_verificadas) as pedidos_sin_lineas
    from limites l
    join ventas v using (periodo)
    left join cobertura_lineas a using (periodo)
    left join resumen_clientes c using (periodo)
  ), cobertura as materialized (
    select b.*,
           case when pedidos = 0 and entregados_excluidos > 0 then 'sin_evidencia'
                when entregados_excluidos > 0 or correcciones_no_verificadas > 0 then 'parcial'
                when pedidos = 0 then 'sin_ventas'
                else 'completa' end as estado_ventas,
           case when pedidos = 0 then 'sin_ventas_reconocidas'
                when pedidos_sin_cliente = pedidos then 'sin_identificar'
                when pedidos_sin_cliente > 0 then 'parcial'
                else 'completa' end as estado_clientes,
           case when pedidos = 0 then 'sin_ventas_reconocidas'
                when pedidos_sin_lineas > 0 or lineas_sin_producto > 0 then 'parcial'
                else 'completa' end as estado_productos
    from bases b
  ), concentracion_bases as (
    select b.periodo,
           b.cerrado and b.estado_ventas = 'completa' and b.estado_clientes = 'completa'
             and b.pedidos >= v_min_pedidos and b.pedidos_positivos >= v_min_pedidos_positivos
             and b.clientes >= v_min_clientes and b.total_clp > 0 as evaluable
    from cobertura b
  ), productos_datos as (
    select p.*, jsonb_build_object(
      'producto_id', p.producto_id,
      'nombre_producto_snapshot', n.nombre,
      'facturacion_lineas_clp', p.clp::text,
      'pedidos_con_entrega', p.pedidos::text,
      'kg_fraccionables_documentados', p.kg::text,
      'lineas_kg_fraccionable', p.lineas_kg::text,
      'participacion_subtotal_lineas_verificadas',
        operativo_privado.fraccion_dashboard_comercial(p.clp, b.subtotal_clp)
    ) as datos
    from productos p
    join cobertura b using (periodo)
    left join nombres_productos n using (periodo, producto_id)
  ), productos_posiciones as (
    select p.periodo, tipos.metrica, p.datos,
           row_number() over (partition by p.periodo, tipos.metrica
                              order by tipos.orden desc, p.producto_id) as posicion
    from productos_datos p
    cross join lateral (values
      ('facturacion', p.clp),
      ('pedidos', nullif(p.pedidos, 0)::numeric),
      ('kg_fraccionables_documentados', p.kg)
    ) tipos(metrica, orden)
    where tipos.orden is not null
  ), productos_listas as (
    select periodo, metrica, count(*) as candidatos,
           jsonb_agg(datos order by posicion) filter (where posicion <= v_limite) as filas
    from productos_posiciones
    group by periodo, metrica
  ), clientes_posiciones as (
    select c.periodo, tipos.metrica,
           jsonb_build_object(
             'cliente_id', c.cliente_id, 'nombre_cliente_actual', catalogo.nombre,
             'facturacion_clp', c.clp::text, 'pedidos', c.pedidos::text,
             'ticket_promedio_clp', operativo_privado.fraccion_dashboard_comercial(c.clp, c.pedidos),
             'frecuencia_pedidos_por_dia_civil', case when c.pedidos >= 2
               then operativo_privado.fraccion_dashboard_comercial(c.pedidos, v_dias) end,
             'participacion_ventas_verificadas',
               operativo_privado.fraccion_dashboard_comercial(c.clp, b.total_clp)
           ) as datos,
           row_number() over (partition by c.periodo, tipos.metrica
                              order by tipos.orden desc, c.cliente_id) as posicion
    from clientes c
    join cobertura b using (periodo)
    left join public.clientes catalogo on catalogo.id = c.cliente_id
    cross join lateral (values
      ('facturacion', c.clp),
      ('pedidos', c.pedidos::numeric),
      -- Los conteos caben en bigint. Dos razones distintas con esos
      -- denominadores difieren en más de 10^-38. La escala entera de
      -- orden conserva el orden exacto sin usar el valor redondeado.
      ('ticket_promedio', case when c.pedidos >= 2 then div(c.clp * 1e40, c.pedidos) end),
      ('frecuencia', case when c.pedidos >= 2 then c.pedidos::numeric end)
    ) tipos(metrica, orden)
    where tipos.orden is not null
  ), clientes_listas as (
    select periodo, metrica, count(*) as candidatos,
           jsonb_agg(datos order by posicion) filter (where posicion <= v_limite) as filas
    from clientes_posiciones
    group by periodo, metrica
  ), poca_venta_posiciones as (
    select p.periodo, p.datos,
           row_number() over (partition by p.periodo order by p.pedidos, p.clp, p.producto_id) as posicion
    from productos_datos p
    join cobertura b using (periodo)
    where b.cerrado and b.estado_ventas = 'completa' and b.estado_productos = 'completa'
      and b.cantidades_desconocidas = 0 and b.lineas_cero_con_importe = 0
      and b.pedidos >= v_min_pedidos
      and p.pedidos between 1 and v_max_pocos_pedidos
  ), poca_venta as (
    select periodo, count(*) as candidatos,
           jsonb_agg(datos order by posicion) filter (where posicion <= v_limite) as filas
    from poca_venta_posiciones
    group by periodo
  ), periodos as (
    select b.periodo, jsonb_build_object(
      'desde', b.desde, 'hasta', b.hasta_exclusivo - 1,
      'desde_utc', b.desde_utc, 'hasta_utc_exclusivo', b.hasta_utc,
      'cerrado', b.cerrado,
      'ventas_reconocidas_clp', case when b.estado_ventas <> 'sin_evidencia' then b.total_clp::text end,
      'pedidos_con_venta_reconocida', b.pedidos::text,
      'pedidos_con_venta_reconocida_positiva', b.pedidos_positivos::text,
      'subtotal_lineas_verificadas_clp', case
        when b.estado_ventas <> 'sin_evidencia' and (b.pedidos = 0 or b.pedidos > b.pedidos_sin_lineas)
        then b.subtotal_clp::text end,
      'cobertura', jsonb_build_object(
        'estado_ventas', b.estado_ventas, 'estado_clientes', b.estado_clientes,
        'estado_productos', b.estado_productos,
        'entregados_sin_evidencia_suficiente', b.entregados_excluidos::text,
        'pedidos_con_correccion_no_verificada', b.correcciones_no_verificadas::text,
        'excluidos_por_motivo', coalesce((select jsonb_object_agg(m.motivo_exclusion, m.pedidos::text)
                                         from motivos m where m.periodo = b.periodo), '{}'::jsonb),
        'pedidos_sin_lineas_verificadas', b.pedidos_sin_lineas::text,
        'pedidos_con_lineas_verificadas', (b.pedidos - b.pedidos_sin_lineas)::text,
        'pedidos_sin_cliente', b.pedidos_sin_cliente::text,
        'facturacion_sin_cliente_clp', b.clp_sin_cliente::text,
        'lineas_sin_producto', b.lineas_sin_producto::text,
        'subtotal_sin_producto_clp', b.clp_sin_producto::text,
        'lineas_con_cantidad_desconocida', b.cantidades_desconocidas::text,
        'lineas_con_cantidad_cero_e_importe_positivo', b.lineas_cero_con_importe::text,
        'lineas_entregadas_fuera_de_kg_fraccionable_documentado', b.lineas_fuera_de_kg::text,
        'estado_kg', case
          when not exists (select 1 from productos_listas x
                           where x.periodo = b.periodo and x.metrica = 'kg_fraccionables_documentados')
            then 'sin_kg_comparables_documentados'
          when b.estado_ventas <> 'completa' or b.estado_productos <> 'completa'
            or b.cantidades_desconocidas > 0 or b.lineas_fuera_de_kg > 0 then 'subconjunto_documentado'
          else 'completa' end,
        'disponibilidad_historica', 'informacion_no_disponible'
      ),
      'rankings_productos', (
        select jsonb_object_agg(k.metrica, jsonb_build_object(
          'candidatos', coalesce(x.candidatos, 0)::text, 'filas', coalesce(x.filas, '[]'::jsonb)
        ))
        from (values ('facturacion'), ('pedidos'), ('kg_fraccionables_documentados')) k(metrica)
        left join productos_listas x on x.periodo = b.periodo and x.metrica = k.metrica
      ),
      'rankings_clientes', (
        select jsonb_object_agg(k.metrica, jsonb_build_object(
          'candidatos', coalesce(x.candidatos, 0)::text, 'filas', coalesce(x.filas, '[]'::jsonb)
        ))
        from (values ('facturacion'), ('pedidos'), ('ticket_promedio'), ('frecuencia')) k(metrica)
        left join clientes_listas x on x.periodo = b.periodo and x.metrica = k.metrica
      ),
      'productos_con_pocas_ventas_observadas', jsonb_build_object(
        'estado', case when b.cerrado and b.estado_ventas = 'completa' and b.estado_productos = 'completa'
                         and b.cantidades_desconocidas = 0 and b.lineas_cero_con_importe = 0
                         and b.pedidos >= v_min_pedidos
                      then 'evaluable' else 'informacion_insuficiente' end,
        'candidatos', coalesce(p.candidatos, 0)::text,
        'filas', coalesce(p.filas, '[]'::jsonb)
      ),
      'concentracion_clientes', jsonb_build_object(
        'estado', case when cb.evaluable
                      then 'evaluable' else 'informacion_insuficiente' end,
        'clientes_identificados', b.clientes::text,
        'clientes_recurrentes', b.recurrentes::text,
        'participacion_primer_cliente', case when cb.evaluable
          then operativo_privado.fraccion_dashboard_comercial(b.primero_clp, b.total_clp) end,
        'participacion_primeros_cinco', case when cb.evaluable
          then operativo_privado.fraccion_dashboard_comercial(b.primeros_cinco_clp, b.total_clp) end
      )
    ) as datos
    from cobertura b
    join concentracion_bases cb using (periodo)
    left join poca_venta p using (periodo)
  ), comparacion as (
    select a.total_clp as actual_clp, h.total_clp as anterior_clp,
           a.pedidos as pedidos_actual, h.pedidos as pedidos_anterior,
           a.clientes as clientes_actual, h.clientes as clientes_anterior,
           a.recurrentes as recurrentes_actual, h.recurrentes as recurrentes_anterior,
           a.primero_clp as primer_cliente_actual_clp,
           h.primero_clp as primer_cliente_anterior_clp,
           a.cerrado and h.cerrado and a.estado_ventas = 'completa' and h.estado_ventas = 'completa'
             and a.pedidos >= v_min_pedidos and h.pedidos >= v_min_pedidos
             and a.pedidos_positivos >= v_min_pedidos_positivos
             and h.pedidos_positivos >= v_min_pedidos_positivos
             and a.total_clp > 0 and h.total_clp > 0 as ventas_evaluables,
           a.estado_clientes = 'completa' and h.estado_clientes = 'completa'
             and a.clientes >= v_min_clientes and h.clientes >= v_min_clientes as clientes_completos
    from cobertura a
    cross join cobertura h
    where a.periodo = 'actual' and h.periodo = 'anterior'
  ), conclusiones as (
    select reglas.*
    from comparacion c
    cross join lateral (values
      (1, 'variacion_facturacion', c.ventas_evaluables,
        abs(c.actual_clp - c.anterior_clp) * 5 >= c.anterior_clp,
        case when c.actual_clp > c.anterior_clp then 'Subió la facturación reconocida.'
             else 'Bajó la facturación reconocida.' end,
        jsonb_build_object('actual_clp', c.actual_clp::text, 'anterior_clp', c.anterior_clp::text,
                           'pedidos_actual', c.pedidos_actual::text, 'pedidos_anterior', c.pedidos_anterior::text),
        'Revisar qué productos y clientes aportaron al cambio antes de ajustar la oferta.'),
      (2, 'variacion_concentracion', c.ventas_evaluables and c.clientes_completos,
        abs(c.primer_cliente_actual_clp * c.anterior_clp - c.primer_cliente_anterior_clp * c.actual_clp)
          * 10 >= c.actual_clp * c.anterior_clp,
        case when c.primer_cliente_actual_clp * c.anterior_clp > c.primer_cliente_anterior_clp * c.actual_clp
             then 'Aumentó la proporción de facturación del cliente líder de cada período.'
             else 'Disminuyó la proporción de facturación del cliente líder de cada período.' end,
        jsonb_build_object(
          'actual', operativo_privado.fraccion_dashboard_comercial(c.primer_cliente_actual_clp, c.actual_clp),
          'anterior', operativo_privado.fraccion_dashboard_comercial(c.primer_cliente_anterior_clp, c.anterior_clp),
          'clientes_actual', c.clientes_actual::text, 'clientes_anterior', c.clientes_anterior::text
        ),
        'Revisar el peso de las cuentas principales y evaluar oportunidades para diversificar la cartera.'),
      (3, 'variacion_recurrencia', c.ventas_evaluables and c.clientes_completos,
        abs(c.recurrentes_actual::numeric * c.clientes_anterior - c.recurrentes_anterior::numeric * c.clientes_actual)
          * 10 >= c.clientes_actual::numeric * c.clientes_anterior,
        case when c.recurrentes_actual::numeric * c.clientes_anterior > c.recurrentes_anterior::numeric * c.clientes_actual
             then 'Aumentó la proporción de clientes con dos o más pedidos reconocidos.'
             else 'Disminuyó la proporción de clientes con dos o más pedidos reconocidos.' end,
        jsonb_build_object(
          'actual', operativo_privado.fraccion_dashboard_comercial(c.recurrentes_actual, c.clientes_actual),
          'anterior', operativo_privado.fraccion_dashboard_comercial(c.recurrentes_anterior, c.clientes_anterior)
        ),
        'Revisar los intervalos de compra y evaluar un seguimiento de clientes con un solo pedido.')
    ) reglas(prioridad, codigo, evaluable, supera_umbral, hecho, evidencia, oportunidad)
  )
  select jsonb_build_object(
    'version', 1, 'moneda', 'CLP', 'zona_horaria', 'America/Santiago',
    'leido_en', statement_timestamp(), 'dias_civiles_por_periodo', v_dias,
    'limite_por_ranking', v_limite,
    'umbrales', jsonb_build_object(
      'min_pedidos_por_periodo', v_min_pedidos, 'min_clientes_por_periodo', v_min_clientes,
      'min_pedidos_positivos_para_comparacion_y_concentracion', v_min_pedidos_positivos,
      'max_pedidos_producto_poca_venta', v_max_pocos_pedidos,
      'min_pedidos_ticket_y_frecuencia', 2, 'min_pedidos_cliente_recurrente', 2,
      'cambio_relativo_minimo_facturacion', '0.20',
      'cambio_absoluto_minimo_proporciones', '0.10'
    ),
    'periodos', (select jsonb_object_agg(periodo, datos) from periodos),
    'comparacion', jsonb_build_object(
      'estado_ventas', case when c.ventas_evaluables then 'evaluable' else 'informacion_insuficiente' end,
      'estado_clientes', case when c.ventas_evaluables and c.clientes_completos
                        then 'evaluable' else 'informacion_insuficiente' end,
      'diferencia_facturacion_clp', case when c.ventas_evaluables then (c.actual_clp - c.anterior_clp)::text end,
      'diferencia_pedidos', case when c.ventas_evaluables then (c.pedidos_actual - c.pedidos_anterior)::text end
    ),
    'estado_conclusiones', (
      select jsonb_object_agg(codigo, case when not evaluable then 'informacion_insuficiente'
                                         when supera_umbral then 'emitida' else 'sin_cambio_material' end)
      from conclusiones
    ),
    'conclusiones', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'codigo', codigo, 'hecho', hecho, 'evidencia', evidencia, 'oportunidad', oportunidad
      ) order by prioridad), '[]'::jsonb)
      from conclusiones where evaluable and supera_umbral
    )
  )
  into v_resultado
  from comparacion c;

  return v_resultado;
end;
$$;

alter function public.leer_dashboard_comercial_rankings_admin(date, date) owner to postgres;
revoke all on function public.leer_dashboard_comercial_rankings_admin(date, date)
  from public, anon, authenticated, service_role;
grant execute on function public.leer_dashboard_comercial_rankings_admin(date, date) to authenticated;

commit;
