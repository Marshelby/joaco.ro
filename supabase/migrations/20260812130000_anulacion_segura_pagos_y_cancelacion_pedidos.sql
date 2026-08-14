-- Vigencia histórica de aplicaciones, anulación de pagos y cancelación de
-- pedidos. Ninguna operación elimina registros financieros u operativos.

alter table public.aplicaciones_pago
  add column activa boolean not null default true,
  add column fecha_anulacion timestamptz,
  add column anulada_por uuid references auth.users(id) on delete set null,
  add column motivo_anulacion text;

alter table public.pagos
  add column fecha_anulacion timestamptz,
  add column anulado_por uuid references auth.users(id) on delete set null,
  add column motivo_anulacion text;

create index aplicaciones_pago_activas_pago_id_idx
  on public.aplicaciones_pago (pago_id)
  where activa;

create index aplicaciones_pago_activas_pedido_id_idx
  on public.aplicaciones_pago (pedido_id)
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
begin
  select * into pago_actual from public.pagos where id = new.pago_id for update;
  if not found then raise exception 'Pago inexistente'; end if;
  if pago_actual.estado = 'anulado' then raise exception 'No se puede aplicar un pago anulado'; end if;
  select * into pedido_actual from public.pedidos where id = new.pedido_id for update;
  if not found then raise exception 'Pedido inexistente'; end if;
  if pedido_actual.cliente_id is null or pedido_actual.cliente_id <> pago_actual.cliente_id then
    raise exception 'El pago y el pedido deben pertenecer al mismo cliente';
  end if;
  if pedido_actual.estado = 'cancelado' then raise exception 'No se puede aplicar un pago a un pedido cancelado'; end if;
  select coalesce(sum(a.monto_aplicado), 0) into aplicado_pago
  from public.aplicaciones_pago a join public.pagos p on p.id = a.pago_id
  where a.pago_id = new.pago_id
    and a.activa
    and p.estado <> 'anulado'
    and a.id is distinct from new.id;
  if aplicado_pago + new.monto_aplicado > pago_actual.monto then
    raise exception 'La aplicación supera el monto disponible del pago';
  end if;
  select coalesce(sum(a.monto_aplicado), 0) into aplicado_pedido
  from public.aplicaciones_pago a join public.pagos p on p.id = a.pago_id
  where a.pedido_id = new.pedido_id
    and a.activa
    and p.estado <> 'anulado'
    and a.id is distinct from new.id;
  if aplicado_pedido + new.monto_aplicado > pedido_actual.total then
    raise exception 'La aplicación supera el saldo pendiente del pedido';
  end if;
  return new;
end;
$$;

create or replace view public.v_saldos_pedidos
with (security_invoker = true)
as
select
  p.id as pedido_id,
  p.cliente_id,
  p.total as total_pedido,
  coalesce(sum(a.monto_aplicado) filter (where pa.estado = 'confirmado' and a.activa), 0)::bigint as total_pagado,
  (p.total - coalesce(sum(a.monto_aplicado) filter (where pa.estado = 'confirmado' and a.activa), 0))::bigint as saldo_pendiente,
  case
    when coalesce(sum(a.monto_aplicado) filter (where pa.estado = 'confirmado' and a.activa), 0) = 0 then 'sin_pago'
    when coalesce(sum(a.monto_aplicado) filter (where pa.estado = 'confirmado' and a.activa), 0) < p.total then 'parcial'
    else 'pagado'
  end as estado_pago
from public.pedidos p
left join public.aplicaciones_pago a on a.pedido_id = p.id
left join public.pagos pa on pa.id = a.pago_id
where p.estado <> 'cancelado'
group by p.id, p.cliente_id, p.total;

create or replace view public.v_saldos_clientes
with (security_invoker = true)
as
select
  c.id as cliente_id,
  coalesce(sum(s.total_pedido), 0)::bigint as total_facturado_relevante,
  coalesce(sum(s.total_pagado), 0)::bigint as total_pagado_aplicado,
  coalesce(sum(s.saldo_pendiente), 0)::bigint as deuda_pendiente,
  count(*) filter (where s.saldo_pendiente > 0)::bigint as cantidad_pedidos_pendientes
from public.clientes c
left join public.v_saldos_pedidos s on s.cliente_id = c.id
group by c.id;

create or replace view public.v_saldos_pagos
with (security_invoker = true)
as
select
  p.id as pago_id,
  p.cliente_id,
  p.monto as monto_pago,
  coalesce(sum(a.monto_aplicado) filter (where p.estado = 'confirmado' and a.activa), 0)::bigint as monto_aplicado,
  case when p.estado = 'confirmado'
    then (p.monto - coalesce(sum(a.monto_aplicado) filter (where a.activa), 0))::bigint
    else 0::bigint
  end as monto_disponible,
  p.estado
from public.pagos p
left join public.aplicaciones_pago a on a.pago_id = p.id
group by p.id, p.cliente_id, p.monto, p.estado;

create or replace function public.registrar_pago_cliente_administrativo(
  p_cliente_id uuid,
  p_monto bigint,
  p_metodo_pago text,
  p_referencia text,
  p_observacion text,
  p_clave_idempotencia uuid
)
returns table (pago_id uuid, monto bigint, monto_aplicado bigint, monto_disponible bigint)
language plpgsql security definer set search_path = public
as $$
declare
  v_pago public.pagos%rowtype;
  v_pedido record;
  v_metodo text := lower(btrim(p_metodo_pago));
  v_restante bigint;
  v_aplicacion bigint;
  v_monto_aplicado bigint;
begin
  if not coalesce(public.es_admin(), false) then raise exception 'NO_AUTORIZADO'; end if;
  if p_clave_idempotencia is null then raise exception 'CLAVE_IDEMPOTENCIA_REQUERIDA'; end if;
  if p_monto is null or p_monto <= 0 then raise exception 'MONTO_INVALIDO'; end if;
  if v_metodo not in ('efectivo', 'transferencia', 'otro', 'tarjeta', 'pago_web') then raise exception 'METODO_PAGO_INVALIDO'; end if;
  perform 1 from public.clientes c where c.id = p_cliente_id and c.activo = true for update;
  if not found then raise exception 'CLIENTE_INVALIDO'; end if;
  select * into v_pago from public.pagos p where p.clave_idempotencia = p_clave_idempotencia for update;
  if found then
    if v_pago.cliente_id is distinct from p_cliente_id then raise exception 'CLAVE_IDEMPOTENCIA_EN_USO'; end if;
    select coalesce(sum(a.monto_aplicado), 0)::bigint into v_monto_aplicado from public.aplicaciones_pago a where a.pago_id = v_pago.id and a.activa;
    return query select v_pago.id, v_pago.monto, v_monto_aplicado, v_pago.monto - v_monto_aplicado;
    return;
  end if;
  insert into public.pagos (cliente_id, monto, metodo_pago, estado, referencia, observacion, registrado_por, fecha_pago, clave_idempotencia)
  values (p_cliente_id, p_monto, v_metodo::public.metodo_pago, 'confirmado', nullif(btrim(p_referencia), ''), nullif(btrim(p_observacion), ''), auth.uid(), now(), p_clave_idempotencia)
  on conflict (clave_idempotencia) where clave_idempotencia is not null do nothing
  returning * into v_pago;
  if v_pago.id is null then
    select * into v_pago from public.pagos p where p.clave_idempotencia = p_clave_idempotencia for update;
    if not found or v_pago.cliente_id is distinct from p_cliente_id then raise exception 'CLAVE_IDEMPOTENCIA_EN_USO'; end if;
    select coalesce(sum(a.monto_aplicado), 0)::bigint into v_monto_aplicado from public.aplicaciones_pago a where a.pago_id = v_pago.id and a.activa;
    return query select v_pago.id, v_pago.monto, v_monto_aplicado, v_pago.monto - v_monto_aplicado;
    return;
  end if;
  perform 1 from public.pedidos p where p.cliente_id = p_cliente_id and p.estado <> 'cancelado' order by p.fecha_creacion, p.id for update;
  v_restante := p_monto;
  for v_pedido in select p.id, s.saldo_pendiente from public.pedidos p join public.v_saldos_pedidos s on s.pedido_id = p.id where p.cliente_id = p_cliente_id and p.estado <> 'cancelado' and s.saldo_pendiente > 0 order by p.fecha_creacion, p.id loop
    exit when v_restante = 0;
    v_aplicacion := least(v_restante, v_pedido.saldo_pendiente);
    insert into public.aplicaciones_pago (pago_id, pedido_id, monto_aplicado) values (v_pago.id, v_pedido.id, v_aplicacion);
    v_restante := v_restante - v_aplicacion;
  end loop;
  v_monto_aplicado := p_monto - v_restante;
  return query select v_pago.id, p_monto, v_monto_aplicado, v_restante;
end;
$$;

create or replace function public.anular_pago_administrativo(p_pago_id uuid, p_motivo text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_pago public.pagos%rowtype;
  v_motivo text := nullif(btrim(p_motivo), '');
begin
  if not coalesce(public.es_admin(), false) then raise exception 'NO_AUTORIZADO'; end if;
  if v_motivo is null then raise exception 'MOTIVO_REQUERIDO'; end if;
  select * into v_pago from public.pagos p where p.id = p_pago_id for update;
  if not found then raise exception 'PAGO_NO_ENCONTRADO'; end if;
  if v_pago.estado = 'anulado' then return v_pago.id; end if;
  if v_pago.estado <> 'confirmado' then raise exception 'ESTADO_PAGO_INVALIDO'; end if;
  perform 1 from public.aplicaciones_pago a where a.pago_id = v_pago.id and a.activa for update;
  update public.aplicaciones_pago set activa = false, fecha_anulacion = now(), anulada_por = auth.uid(), motivo_anulacion = v_motivo where pago_id = v_pago.id and activa;
  update public.pagos set estado = 'anulado', fecha_anulacion = now(), anulado_por = auth.uid(), motivo_anulacion = v_motivo where id = v_pago.id;
  return v_pago.id;
end;
$$;

create or replace function public.cancelar_pedido_administrativo(p_pedido_id uuid, p_motivo text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_pedido public.pedidos%rowtype;
  v_motivo text := nullif(btrim(p_motivo), '');
begin
  if not coalesce(public.es_admin(), false) then raise exception 'NO_AUTORIZADO'; end if;
  if v_motivo is null then raise exception 'MOTIVO_REQUERIDO'; end if;
  select * into v_pedido from public.pedidos p where p.id = p_pedido_id for update;
  if not found then raise exception 'PEDIDO_NO_ENCONTRADO'; end if;
  if v_pedido.estado = 'cancelado' then return v_pedido.id; end if;
  if v_pedido.estado not in ('recibido', 'en_revision', 'confirmado', 'programado', 'preparando') then raise exception 'ESTADO_PEDIDO_INVALIDO'; end if;
  perform 1 from public.aplicaciones_pago a where a.pedido_id = v_pedido.id and a.activa for update;
  update public.aplicaciones_pago set activa = false, fecha_anulacion = now(), anulada_por = auth.uid(), motivo_anulacion = v_motivo where pedido_id = v_pedido.id and activa;
  update public.pedidos set estado = 'cancelado' where id = v_pedido.id;
  update public.historial_estados_pedido set observacion = v_motivo where id = (select h.id from public.historial_estados_pedido h where h.pedido_id = v_pedido.id and h.estado_nuevo = 'cancelado' order by h.fecha_creacion desc, h.id desc limit 1);
  return v_pedido.id;
end;
$$;

alter function public.anular_pago_administrativo(uuid, text) owner to postgres;
alter function public.cancelar_pedido_administrativo(uuid, text) owner to postgres;

revoke all on function public.anular_pago_administrativo(uuid, text) from public, anon, authenticated;
revoke all on function public.cancelar_pedido_administrativo(uuid, text) from public, anon, authenticated;
grant execute on function public.anular_pago_administrativo(uuid, text) to authenticated;
grant execute on function public.cancelar_pedido_administrativo(uuid, text) to authenticated;

revoke all on public.v_saldos_pedidos, public.v_saldos_clientes, public.v_saldos_pagos from public, anon, authenticated;
grant select on public.v_saldos_pedidos, public.v_saldos_clientes, public.v_saldos_pagos to authenticated;
