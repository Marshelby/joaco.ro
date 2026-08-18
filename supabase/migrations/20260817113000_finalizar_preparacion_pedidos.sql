-- P3: cierre atómico de preparación, total exigible final y liberación auditable
-- de aplicaciones que exceden el monto final. Los pedidos e ítems originales
-- permanecen como snapshots de la solicitud inicial.

alter table public.aplicaciones_pago
  drop constraint aplicaciones_pago_unica_por_pago_y_pedido;

create unique index aplicaciones_pago_una_activa_por_pago_y_pedido_idx
  on public.aplicaciones_pago (pago_id, pedido_id)
  where activa;

create or replace function public.validar_aplicacion_pago()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  pago_actual public.pagos%rowtype;
  pedido_actual public.pedidos%rowtype;
  aplicado_pago bigint;
  aplicado_pedido bigint;
  total_exigible bigint;
begin
  select * into pago_actual from public.pagos where id = new.pago_id for update;
  if not found then raise exception 'Pago inexistente'; end if;
  if pago_actual.estado = 'anulado' then raise exception 'No se puede aplicar un pago anulado'; end if;

  select * into pedido_actual from public.pedidos where id = new.pedido_id for update;
  if not found then raise exception 'Pedido inexistente'; end if;
  if pedido_actual.cliente_id is null or pedido_actual.cliente_id <> pago_actual.cliente_id then raise exception 'El pago y el pedido deben pertenecer al mismo cliente'; end if;
  if pedido_actual.estado = 'cancelado' then raise exception 'No se puede aplicar un pago a un pedido cancelado'; end if;

  select coalesce(sum(a.monto_aplicado), 0) into aplicado_pago
  from public.aplicaciones_pago a
  join public.pagos p on p.id = a.pago_id
  where a.pago_id = new.pago_id and a.activa and p.estado <> 'anulado' and a.id is distinct from new.id;
  if aplicado_pago + new.monto_aplicado > pago_actual.monto then raise exception 'La aplicación supera el monto disponible del pago'; end if;

  select coalesce(sum(a.monto_aplicado), 0) into aplicado_pedido
  from public.aplicaciones_pago a
  join public.pagos p on p.id = a.pago_id
  where a.pedido_id = new.pedido_id and a.activa and p.estado <> 'anulado' and a.id is distinct from new.id;
  total_exigible := coalesce(pedido_actual.total_final, pedido_actual.total);
  if aplicado_pedido + new.monto_aplicado > total_exigible then raise exception 'La aplicación supera el saldo pendiente del pedido'; end if;
  return new;
end;
$$;

create or replace view public.v_saldos_pedidos
with (security_invoker = true)
as
select
  p.id as pedido_id,
  p.cliente_id,
  coalesce(p.total_final, p.total) as total_pedido,
  coalesce(sum(a.monto_aplicado) filter (where pa.estado = 'confirmado' and a.activa), 0)::bigint as total_pagado,
  (coalesce(p.total_final, p.total) - coalesce(sum(a.monto_aplicado) filter (where pa.estado = 'confirmado' and a.activa), 0))::bigint as saldo_pendiente,
  case
    when coalesce(sum(a.monto_aplicado) filter (where pa.estado = 'confirmado' and a.activa), 0) = 0 then 'sin_pago'
    when coalesce(sum(a.monto_aplicado) filter (where pa.estado = 'confirmado' and a.activa), 0) < coalesce(p.total_final, p.total) then 'parcial'
    else 'pagado'
  end as estado_pago
from public.pedidos p
left join public.aplicaciones_pago a on a.pedido_id = p.id
left join public.pagos pa on pa.id = a.pago_id
where p.estado <> 'cancelado'
group by p.id, p.cliente_id, p.total, p.total_final;

create or replace view public.v_movimientos_cuenta_cliente
with (security_invoker = true)
as
with movimientos_base as (
  select p.cliente_id, p.fecha_creacion as fecha, 'pedido'::text as tipo_movimiento, p.id as referencia_id,
    p.numero_pedido as referencia, ('Pedido ' || p.numero_pedido) as concepto,
    coalesce(p.total_final, p.total) as cargo, 0::bigint as abono,
    coalesce(p.total_final, p.total) as movimiento_neto, p.fecha_creacion, 1 as prioridad_orden
  from public.pedidos p where p.cliente_id is not null and p.estado <> 'cancelado'
  union all
  select p.cliente_id, p.fecha_pago, 'pago'::text, p.id,
    coalesce(nullif(btrim(p.referencia), ''), 'Pago ' || left(p.id::text, 8)), ('Pago ' || p.metodo_pago::text),
    0::bigint, p.monto, -p.monto, p.fecha_creacion, 2
  from public.pagos p where p.estado = 'confirmado'
  union all
  select a.cliente_id, a.fecha_ajuste, 'ajuste'::text, a.id, 'Ajuste ' || left(a.id::text, 8), a.motivo,
    case when a.tipo = 'cargo' then a.monto else 0::bigint end,
    case when a.tipo = 'abono' then a.monto else 0::bigint end,
    case when a.tipo = 'cargo' then a.monto else -a.monto end, a.fecha_creacion, 3
  from public.ajustes_cuenta_cliente a
)
select cliente_id, fecha, tipo_movimiento, referencia_id, referencia, concepto, cargo, abono, movimiento_neto,
  sum(movimiento_neto) over (partition by cliente_id order by fecha, prioridad_orden, fecha_creacion, referencia_id rows between unbounded preceding and current row)::bigint as saldo_acumulado
from movimientos_base;

create function public.finalizar_preparacion_pedido_administrativo(p_pedido_id uuid)
returns table (
  pedido_id uuid,
  estado public.estado_pedido,
  preparacion_estado text,
  subtotal_final bigint,
  total_final bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pedido public.pedidos%rowtype;
  v_item public.items_pedido%rowtype;
  v_preparada numeric;
  v_modo text;
  v_subtotal bigint := 0;
  v_total bigint;
  v_completa boolean := true;
  v_aplicado bigint := 0;
  v_exceso bigint := 0;
  v_aplicacion public.aplicaciones_pago%rowtype;
  v_conservar bigint;
  v_lineas_faltantes integer := 0;
  v_observacion text;
begin
  if not coalesce(public.es_admin(), false) then raise exception 'NO_AUTORIZADO'; end if;
  select * into v_pedido from public.pedidos p where p.id = p_pedido_id for update;
  if not found then raise exception 'PEDIDO_NO_ENCONTRADO'; end if;

  if v_pedido.estado = 'listo_despacho'
    and v_pedido.preparacion_estado in ('completa', 'incompleta')
    and v_pedido.preparacion_finalizada_en is not null
    and v_pedido.subtotal_final is not null
    and v_pedido.total_final is not null then
    return query select v_pedido.id, v_pedido.estado, v_pedido.preparacion_estado, v_pedido.subtotal_final, v_pedido.total_final;
    return;
  end if;
  if v_pedido.estado <> 'preparando' then raise exception 'ESTADO_PEDIDO_INVALIDO'; end if;

  perform 1 from public.items_pedido i where i.pedido_id = v_pedido.id order by i.id for update;
  perform 1 from public.preparacion_items_pedido pi where pi.pedido_id = v_pedido.id order by pi.item_pedido_id for update;

  for v_item in select * from public.items_pedido i where i.pedido_id = v_pedido.id order by i.id loop
    select pi.cantidad_preparada into v_preparada from public.preparacion_items_pedido pi where pi.item_pedido_id = v_item.id;
    v_preparada := coalesce(v_preparada, v_item.cantidad);
    if v_preparada < 0 or v_preparada > v_item.cantidad then raise exception 'CANTIDAD_PREPARADA_INVALIDA'; end if;
    v_modo := coalesce(v_item.modo_cantidad_snapshot, case
      when upper(btrim(v_item.unidad_snapshot)) = 'KG' and lower(coalesce(v_item.nombre_presentacion_snapshot, '')) !~ '(saco|malla|caja|paquete|docena)' then 'kg_fraccionable'
      when lower(coalesce(v_item.nombre_presentacion_snapshot, '')) ~ '(saco|malla|caja|paquete|docena)' then 'presentacion_cerrada'
      else 'unidad' end);
    if v_modo in ('presentacion_cerrada', 'unidad') and v_preparada <> trunc(v_preparada) then raise exception 'CANTIDAD_PREPARADA_DEBE_SER_ENTERA'; end if;
    v_subtotal := v_subtotal + round(v_preparada * v_item.precio_final_unitario_snapshot)::bigint;
    if v_preparada < v_item.cantidad then v_completa := false; v_lineas_faltantes := v_lineas_faltantes + 1; end if;
  end loop;

  v_total := v_subtotal + v_pedido.costo_entrega - v_pedido.descuento;
  if v_total < 0 then raise exception 'TOTAL_FINAL_INVALIDO'; end if;
  if v_completa and (v_subtotal <> v_pedido.subtotal or v_total <> v_pedido.total) then raise exception 'PREPARACION_COMPLETA_INCONSISTENTE'; end if;

  -- El nuevo límite debe estar visible para el trigger al recrear aplicaciones activas.
  update public.pedidos set subtotal_final = v_subtotal, total_final = v_total where id = v_pedido.id;

  perform 1 from public.aplicaciones_pago a where a.pedido_id = v_pedido.id and a.activa order by a.fecha_creacion desc, a.id desc for update;
  perform 1 from public.pagos p where p.id in (select a.pago_id from public.aplicaciones_pago a where a.pedido_id = v_pedido.id and a.activa) order by p.id for update;
  select coalesce(sum(a.monto_aplicado), 0)::bigint into v_aplicado from public.aplicaciones_pago a where a.pedido_id = v_pedido.id and a.activa;
  v_exceso := greatest(v_aplicado - v_total, 0);

  for v_aplicacion in select * from public.aplicaciones_pago a where a.pedido_id = v_pedido.id and a.activa order by a.fecha_creacion desc, a.id desc loop
    exit when v_exceso = 0;
    v_conservar := greatest(v_aplicacion.monto_aplicado - v_exceso, 0);
    update public.aplicaciones_pago set activa = false, fecha_anulacion = now(), anulada_por = auth.uid(), motivo_anulacion = 'Reajuste por preparación incompleta' where id = v_aplicacion.id;
    if v_conservar > 0 then
      insert into public.aplicaciones_pago (pago_id, pedido_id, monto_aplicado) values (v_aplicacion.pago_id, v_pedido.id, v_conservar);
    end if;
    v_exceso := greatest(v_exceso - v_aplicacion.monto_aplicado, 0);
  end loop;

  select coalesce(sum(a.monto_aplicado), 0)::bigint into v_aplicado from public.aplicaciones_pago a where a.pedido_id = v_pedido.id and a.activa;
  if v_aplicado > v_total then raise exception 'APLICACIONES_SUPERAN_TOTAL_FINAL'; end if;

  update public.pedidos
  set preparacion_estado = case when v_completa then 'completa' else 'incompleta' end,
      preparacion_finalizada_en = now(), preparacion_finalizada_por = auth.uid(), estado = 'listo_despacho'
  where id = v_pedido.id;
  v_observacion := case when v_completa then 'Preparación finalizada completa' else format('Preparación finalizada incompleta: %s líneas con faltantes', v_lineas_faltantes) end;
  update public.historial_estados_pedido set observacion = v_observacion
  where id = (select h.id from public.historial_estados_pedido h where h.pedido_id = v_pedido.id and h.estado_nuevo = 'listo_despacho' order by h.fecha_creacion desc, h.id desc limit 1);
  return query select v_pedido.id, 'listo_despacho'::public.estado_pedido, case when v_completa then 'completa' else 'incompleta' end, v_subtotal, v_total;
end;
$$;

alter function public.finalizar_preparacion_pedido_administrativo(uuid) owner to postgres;
revoke all on function public.finalizar_preparacion_pedido_administrativo(uuid) from public, anon, authenticated;
grant execute on function public.finalizar_preparacion_pedido_administrativo(uuid) to authenticated;

revoke all on public.v_saldos_pedidos, public.v_saldos_clientes, public.v_saldos_pagos, public.v_movimientos_cuenta_cliente, public.v_saldos_cuenta_clientes from public, anon;
grant select on public.v_saldos_pedidos, public.v_saldos_clientes, public.v_saldos_pagos, public.v_movimientos_cuenta_cliente, public.v_saldos_cuenta_clientes to authenticated;
