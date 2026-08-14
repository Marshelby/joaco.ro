-- Avance administrativo explícito del ciclo operativo. Cada función permite
-- sólo una transición para no exponer un cambio de estado arbitrario.

create function public.marcar_pedido_preparando_administrativo(
  p_pedido_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pedido public.pedidos%rowtype;
begin
  if not coalesce(public.es_admin(), false) then raise exception 'NO_AUTORIZADO'; end if;

  select * into v_pedido from public.pedidos p where p.id = p_pedido_id for update;
  if not found then raise exception 'PEDIDO_NO_ENCONTRADO'; end if;
  if v_pedido.estado = 'preparando' then return v_pedido.id; end if;
  if v_pedido.estado <> 'confirmado' then raise exception 'ESTADO_PEDIDO_INVALIDO'; end if;

  update public.pedidos set estado = 'preparando' where id = v_pedido.id;
  return v_pedido.id;
end;
$$;

create function public.marcar_pedido_listo_despacho_administrativo(
  p_pedido_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pedido public.pedidos%rowtype;
begin
  if not coalesce(public.es_admin(), false) then raise exception 'NO_AUTORIZADO'; end if;

  select * into v_pedido from public.pedidos p where p.id = p_pedido_id for update;
  if not found then raise exception 'PEDIDO_NO_ENCONTRADO'; end if;
  if v_pedido.estado = 'listo_despacho' then return v_pedido.id; end if;
  if v_pedido.estado <> 'preparando' then raise exception 'ESTADO_PEDIDO_INVALIDO'; end if;

  update public.pedidos set estado = 'listo_despacho' where id = v_pedido.id;
  return v_pedido.id;
end;
$$;

create function public.marcar_pedido_en_reparto_administrativo(
  p_pedido_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pedido public.pedidos%rowtype;
begin
  if not coalesce(public.es_admin(), false) then raise exception 'NO_AUTORIZADO'; end if;

  select * into v_pedido from public.pedidos p where p.id = p_pedido_id for update;
  if not found then raise exception 'PEDIDO_NO_ENCONTRADO'; end if;
  if v_pedido.estado = 'en_reparto' then return v_pedido.id; end if;
  if v_pedido.estado <> 'listo_despacho' then raise exception 'ESTADO_PEDIDO_INVALIDO'; end if;

  update public.pedidos set estado = 'en_reparto' where id = v_pedido.id;
  return v_pedido.id;
end;
$$;

create function public.marcar_pedido_entregado_administrativo(
  p_pedido_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pedido public.pedidos%rowtype;
begin
  if not coalesce(public.es_admin(), false) then raise exception 'NO_AUTORIZADO'; end if;

  select * into v_pedido from public.pedidos p where p.id = p_pedido_id for update;
  if not found then raise exception 'PEDIDO_NO_ENCONTRADO'; end if;
  if v_pedido.estado = 'entregado' then return v_pedido.id; end if;
  if v_pedido.estado <> 'en_reparto' then raise exception 'ESTADO_PEDIDO_INVALIDO'; end if;

  update public.pedidos set estado = 'entregado' where id = v_pedido.id;
  return v_pedido.id;
end;
$$;

alter function public.marcar_pedido_preparando_administrativo(uuid) owner to postgres;
alter function public.marcar_pedido_listo_despacho_administrativo(uuid) owner to postgres;
alter function public.marcar_pedido_en_reparto_administrativo(uuid) owner to postgres;
alter function public.marcar_pedido_entregado_administrativo(uuid) owner to postgres;

revoke all on function public.marcar_pedido_preparando_administrativo(uuid) from public, anon, authenticated;
revoke all on function public.marcar_pedido_listo_despacho_administrativo(uuid) from public, anon, authenticated;
revoke all on function public.marcar_pedido_en_reparto_administrativo(uuid) from public, anon, authenticated;
revoke all on function public.marcar_pedido_entregado_administrativo(uuid) from public, anon, authenticated;

grant execute on function public.marcar_pedido_preparando_administrativo(uuid) to authenticated;
grant execute on function public.marcar_pedido_listo_despacho_administrativo(uuid) to authenticated;
grant execute on function public.marcar_pedido_en_reparto_administrativo(uuid) to authenticated;
grant execute on function public.marcar_pedido_entregado_administrativo(uuid) to authenticated;
