-- Evita la ambigüedad entre el parámetro de salida pedido_id y la columna
-- aplicaciones_pago.pedido_id en la actualización de liberación.

create or replace function public.cancelar_pedido_cliente(
  p_pedido_id uuid,
  p_motivo text default null
)
returns table (
  pedido_id uuid,
  numero_pedido text,
  estado public.estado_pedido,
  cliente_id uuid,
  fecha_entrega date
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cliente_id uuid;
  v_pedido public.pedidos%rowtype;
  v_motivo text := nullif(btrim(p_motivo), '');
  v_observacion text;
begin
  if auth.uid() is null or coalesce(public.es_admin(), false) then
    raise exception 'NO_AUTORIZADO';
  end if;

  select c.id into v_cliente_id
  from public.clientes c
  where c.usuario_id = auth.uid() and c.activo = true;

  if not found then raise exception 'NO_AUTORIZADO'; end if;
  if v_motivo is not null and char_length(v_motivo) > 400 then
    raise exception 'MOTIVO_DEMASIADO_LARGO';
  end if;

  select * into v_pedido
  from public.pedidos p
  where p.id = p_pedido_id
  for update;

  if not found then raise exception 'PEDIDO_NO_ENCONTRADO'; end if;
  if v_pedido.cliente_id is distinct from v_cliente_id then raise exception 'NO_AUTORIZADO'; end if;

  if v_pedido.estado = 'cancelado' then
    return query select v_pedido.id, v_pedido.numero_pedido, v_pedido.estado, v_pedido.cliente_id, v_pedido.fecha_entrega;
    return;
  end if;
  if v_pedido.estado <> 'recibido' then raise exception 'ESTADO_PEDIDO_INVALIDO'; end if;

  v_observacion := 'Cancelado por el cliente' || case when v_motivo is null then '' else ': ' || v_motivo end;

  perform 1 from public.aplicaciones_pago a
  where a.pedido_id = v_pedido.id and a.activa
  for update;

  update public.aplicaciones_pago a
  set activa = false, fecha_anulacion = now(), anulada_por = auth.uid(), motivo_anulacion = v_observacion
  where a.pedido_id = v_pedido.id and a.activa;

  update public.pedidos set estado = 'cancelado'
  where id = v_pedido.id
  returning * into v_pedido;

  update public.historial_estados_pedido h
  set observacion = v_observacion
  where h.id = (
    select ultimo.id from public.historial_estados_pedido ultimo
    where ultimo.pedido_id = v_pedido.id and ultimo.estado_nuevo = 'cancelado'
    order by ultimo.fecha_creacion desc, ultimo.id desc
    limit 1
  );

  return query select v_pedido.id, v_pedido.numero_pedido, v_pedido.estado, v_pedido.cliente_id, v_pedido.fecha_entrega;
end;
$$;

alter function public.cancelar_pedido_cliente(uuid, text) owner to postgres;
revoke all on function public.cancelar_pedido_cliente(uuid, text) from public, anon, authenticated;
grant execute on function public.cancelar_pedido_cliente(uuid, text) to authenticated;
