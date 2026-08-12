create function public.aceptar_pedido_administrativo(
  p_pedido_id uuid
)
returns table (
  pedido_id uuid,
  numero_pedido text,
  estado public.estado_pedido,
  fecha_actualizacion timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pedido public.pedidos%rowtype;
begin
  if not public.es_admin() then
    raise exception 'NO_AUTORIZADO';
  end if;

  select *
  into v_pedido
  from public.pedidos p
  where p.id = p_pedido_id
  for update;

  if not found then
    raise exception 'PEDIDO_NO_ENCONTRADO';
  end if;

  if v_pedido.estado = 'confirmado' then
    return query select v_pedido.id, v_pedido.numero_pedido, v_pedido.estado, v_pedido.fecha_actualizacion;
    return;
  end if;

  if v_pedido.estado <> 'recibido' then
    raise exception 'ESTADO_PEDIDO_INVALIDO';
  end if;

  update public.pedidos
  set estado = 'confirmado'
  where id = v_pedido.id
  returning * into v_pedido;

  return query select v_pedido.id, v_pedido.numero_pedido, v_pedido.estado, v_pedido.fecha_actualizacion;
end;
$$;

revoke all on function public.aceptar_pedido_administrativo(uuid) from public, anon, authenticated;
grant execute on function public.aceptar_pedido_administrativo(uuid) to authenticated;
