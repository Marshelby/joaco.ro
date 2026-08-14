-- Registro administrativo atómico de pagos confirmados y distribución FIFO a
-- pedidos. La cuenta global sigue derivándose del pago completo en las vistas.

alter table public.pagos
  add column clave_idempotencia uuid;

create unique index pagos_clave_idempotencia_unica
  on public.pagos (clave_idempotencia)
  where clave_idempotencia is not null;

create or replace function public.registrar_pago_cliente_administrativo(
  p_cliente_id uuid,
  p_monto bigint,
  p_metodo_pago text,
  p_referencia text,
  p_observacion text,
  p_clave_idempotencia uuid
)
returns table (
  pago_id uuid,
  monto bigint,
  monto_aplicado bigint,
  monto_disponible bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pago public.pagos%rowtype;
  v_pedido record;
  v_metodo text := lower(btrim(p_metodo_pago));
  v_restante bigint;
  v_aplicacion bigint;
  v_monto_aplicado bigint;
begin
  if not coalesce(public.es_admin(), false) then
    raise exception 'NO_AUTORIZADO';
  end if;

  if p_clave_idempotencia is null then
    raise exception 'CLAVE_IDEMPOTENCIA_REQUERIDA';
  end if;

  if p_monto is null or p_monto <= 0 then
    raise exception 'MONTO_INVALIDO';
  end if;

  if v_metodo not in ('efectivo', 'transferencia', 'otro', 'tarjeta', 'pago_web') then
    raise exception 'METODO_PAGO_INVALIDO';
  end if;

  -- Serializa los pagos automáticos de un mismo cliente antes de leer los
  -- saldos aplicables; así dos pagos no distribuyen el mismo saldo pendiente.
  perform 1
  from public.clientes c
  where c.id = p_cliente_id
    and c.activo = true
  for update;

  if not found then
    raise exception 'CLIENTE_INVALIDO';
  end if;

  select * into v_pago
  from public.pagos p
  where p.clave_idempotencia = p_clave_idempotencia
  for update;

  if found then
    if v_pago.cliente_id is distinct from p_cliente_id then
      raise exception 'CLAVE_IDEMPOTENCIA_EN_USO';
    end if;

    select coalesce(sum(a.monto_aplicado), 0)::bigint into v_monto_aplicado
    from public.aplicaciones_pago a
    where a.pago_id = v_pago.id;

    return query select v_pago.id, v_pago.monto, v_monto_aplicado, v_pago.monto - v_monto_aplicado;
    return;
  end if;

  insert into public.pagos (
    cliente_id, monto, metodo_pago, estado, referencia, observacion,
    registrado_por, fecha_pago, clave_idempotencia
  ) values (
    p_cliente_id, p_monto, v_metodo::public.metodo_pago, 'confirmado',
    nullif(btrim(p_referencia), ''), nullif(btrim(p_observacion), ''),
    auth.uid(), now(), p_clave_idempotencia
  )
  on conflict (clave_idempotencia) where clave_idempotencia is not null do nothing
  returning * into v_pago;

  if v_pago.id is null then
    select * into v_pago
    from public.pagos p
    where p.clave_idempotencia = p_clave_idempotencia
    for update;

    if not found or v_pago.cliente_id is distinct from p_cliente_id then
      raise exception 'CLAVE_IDEMPOTENCIA_EN_USO';
    end if;

    select coalesce(sum(a.monto_aplicado), 0)::bigint into v_monto_aplicado
    from public.aplicaciones_pago a
    where a.pago_id = v_pago.id;

    return query select v_pago.id, v_pago.monto, v_monto_aplicado, v_pago.monto - v_monto_aplicado;
    return;
  end if;

  -- Bloquea las filas base de pedidos antes de consultar v_saldos_pedidos,
  -- la autoridad existente para el saldo aplicable de cada pedido.
  perform 1
  from public.pedidos p
  where p.cliente_id = p_cliente_id
    and p.estado <> 'cancelado'
  order by p.fecha_creacion, p.id
  for update;

  v_restante := p_monto;
  for v_pedido in
    select p.id, s.saldo_pendiente
    from public.pedidos p
    join public.v_saldos_pedidos s on s.pedido_id = p.id
    where p.cliente_id = p_cliente_id
      and p.estado <> 'cancelado'
      and s.saldo_pendiente > 0
    order by p.fecha_creacion, p.id
  loop
    exit when v_restante = 0;
    v_aplicacion := least(v_restante, v_pedido.saldo_pendiente);
    insert into public.aplicaciones_pago (pago_id, pedido_id, monto_aplicado)
    values (v_pago.id, v_pedido.id, v_aplicacion);
    v_restante := v_restante - v_aplicacion;
  end loop;

  v_monto_aplicado := p_monto - v_restante;
  return query select v_pago.id, p_monto, v_monto_aplicado, v_restante;
end;
$$;

alter function public.registrar_pago_cliente_administrativo(uuid, bigint, text, text, text, uuid) owner to postgres;

revoke all on function public.registrar_pago_cliente_administrativo(uuid, bigint, text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.registrar_pago_cliente_administrativo(uuid, bigint, text, text, text, uuid) to authenticated;
