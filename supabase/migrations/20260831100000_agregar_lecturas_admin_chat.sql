-- Lecturas agregadas para el inbox administrativo de Chat.

create function public.listar_conversaciones_chat_administrativas(
  p_solo_no_leidos boolean default false,
  p_cursor_ultimo_mensaje_en timestamptz default null,
  p_cursor_conversacion_id uuid default null,
  p_limite integer default 30
)
returns table (
  conversacion_id uuid,
  cliente_id uuid,
  cliente_nombre text,
  cliente_telefono text,
  cliente_email text,
  cliente_usuario_id uuid,
  cliente_activo boolean,
  ultimo_mensaje_preview text,
  ultimo_mensaje_en timestamptz,
  ultimo_remitente_tipo text,
  admin_ultimo_leido_en timestamptz,
  fecha_actualizacion timestamptz,
  mensajes_no_leidos bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.es_admin() then
    raise exception 'CHAT_ADMIN_NO_AUTORIZADO';
  end if;

  return query
  select
    cc.id,
    c.id,
    c.nombre,
    c.telefono,
    c.email,
    c.usuario_id,
    c.activo,
    cc.ultimo_mensaje_preview,
    cc.ultimo_mensaje_en,
    cc.ultimo_remitente_tipo,
    cc.admin_ultimo_leido_en,
    cc.fecha_actualizacion,
    coalesce(no_leidos.cantidad, 0)::bigint
  from public.conversaciones_cliente cc
  join public.clientes c on c.id = cc.cliente_id
  left join lateral (
    select count(*)::bigint as cantidad
    from public.mensajes_conversacion m
    where m.conversacion_id = cc.id
      and m.remitente_tipo = 'cliente'
      and m.fecha_creacion > coalesce(cc.admin_ultimo_leido_en, '-infinity'::timestamptz)
  ) no_leidos on true
  where (not p_solo_no_leidos or coalesce(no_leidos.cantidad, 0) > 0)
    and (
      p_cursor_ultimo_mensaje_en is null
      or cc.ultimo_mensaje_en < p_cursor_ultimo_mensaje_en
      or (cc.ultimo_mensaje_en = p_cursor_ultimo_mensaje_en and cc.id < p_cursor_conversacion_id)
    )
  order by cc.ultimo_mensaje_en desc nulls last, cc.id desc
  limit least(greatest(coalesce(p_limite, 30), 1), 50);
end;
$$;

create function public.obtener_resumen_chat_administrativo()
returns table (
  mensajes_no_leidos bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.es_admin() then
    raise exception 'CHAT_ADMIN_NO_AUTORIZADO';
  end if;

  return query
  select count(*)::bigint
  from public.mensajes_conversacion m
  join public.conversaciones_cliente cc on cc.id = m.conversacion_id
  where m.remitente_tipo = 'cliente'
    and m.fecha_creacion > coalesce(cc.admin_ultimo_leido_en, '-infinity'::timestamptz);
end;
$$;

alter function public.listar_conversaciones_chat_administrativas(boolean, timestamptz, uuid, integer) owner to postgres;
alter function public.obtener_resumen_chat_administrativo() owner to postgres;

revoke all on function public.listar_conversaciones_chat_administrativas(boolean, timestamptz, uuid, integer) from public, anon, authenticated;
revoke all on function public.obtener_resumen_chat_administrativo() from public, anon, authenticated;
grant execute on function public.listar_conversaciones_chat_administrativas(boolean, timestamptz, uuid, integer) to authenticated;
grant execute on function public.obtener_resumen_chat_administrativo() to authenticated;
