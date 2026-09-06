-- Corrige la resolución ambigua de fecha_creacion en la RPC inicial de Chat.
-- Se conserva la firma, permisos y comportamiento establecidos en P1.

create or replace function public.enviar_mensaje_conversacion(
  p_cliente_id uuid,
  p_contenido text,
  p_pedido_id uuid,
  p_clave_idempotencia uuid
)
returns table (
  mensaje_id uuid,
  conversacion_id uuid,
  remitente_usuario_id uuid,
  remitente_tipo text,
  remitente_nombre_snapshot text,
  contenido text,
  pedido_id uuid,
  fecha_creacion timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario_id uuid := auth.uid();
  v_rol public.rol_perfil;
  v_nombre_perfil text;
  v_email_perfil text;
  v_cliente_id uuid;
  v_cliente_nombre text;
  v_cliente_activo boolean;
  v_remitente_tipo text;
  v_remitente_nombre text;
  v_contenido text;
  v_conversacion_id uuid;
  v_mensaje_id uuid;
  v_mensaje_fecha timestamptz;
  v_mensajes_recientes integer;
begin
  if v_usuario_id is null then
    raise exception 'CHAT_NO_AUTENTICADO';
  end if;

  select p.rol, p.nombre, u.email
  into v_rol, v_nombre_perfil, v_email_perfil
  from public.perfiles p
  join auth.users u on u.id = p.usuario_id
  where p.usuario_id = v_usuario_id;

  if not found or v_rol not in ('cliente'::public.rol_perfil, 'admin'::public.rol_perfil) then
    raise exception 'CHAT_ACTOR_INVALIDO';
  end if;

  v_contenido := btrim(coalesce(p_contenido, ''));

  if v_contenido = '' then
    raise exception 'CHAT_MENSAJE_VACIO';
  end if;

  if char_length(v_contenido) > 2000 then
    raise exception 'CHAT_MENSAJE_DEMASIADO_LARGO';
  end if;

  if p_clave_idempotencia is null then
    raise exception 'CHAT_CLAVE_IDEMPOTENCIA_REQUERIDA';
  end if;

  if v_rol = 'cliente'::public.rol_perfil then
    select c.id, c.nombre
    into v_cliente_id, v_cliente_nombre
    from public.clientes c
    where c.usuario_id = v_usuario_id
      and c.activo = true;

    if not found then
      raise exception 'CHAT_CLIENTE_NO_DISPONIBLE';
    end if;

    if p_cliente_id is not null and p_cliente_id is distinct from v_cliente_id then
      raise exception 'CHAT_CLIENTE_DESTINO_INVALIDO';
    end if;

    v_remitente_tipo := 'cliente';
    v_remitente_nombre := nullif(btrim(v_cliente_nombre), '');
  else
    if p_cliente_id is null then
      raise exception 'CHAT_CLIENTE_REQUERIDO';
    end if;

    select c.id, c.nombre, c.activo
    into v_cliente_id, v_cliente_nombre, v_cliente_activo
    from public.clientes c
    where c.id = p_cliente_id;

    if not found then
      raise exception 'CHAT_CLIENTE_INEXISTENTE';
    end if;

    if not v_cliente_activo then
      raise exception 'CHAT_CLIENTE_INACTIVO';
    end if;

    v_remitente_tipo := 'admin';
    v_remitente_nombre := coalesce(nullif(btrim(v_nombre_perfil), ''), nullif(btrim(v_email_perfil), ''));
  end if;

  if v_remitente_nombre is null then
    raise exception 'CHAT_REMITENTE_SIN_NOMBRE';
  end if;

  select m.id, m.conversacion_id, m.fecha_creacion
  into v_mensaje_id, v_conversacion_id, v_mensaje_fecha
  from public.mensajes_conversacion m
  where m.remitente_usuario_id = v_usuario_id
    and m.clave_idempotencia = p_clave_idempotencia;

  if found then
    return query
    select m.id, m.conversacion_id, m.remitente_usuario_id, m.remitente_tipo,
      m.remitente_nombre_snapshot, m.contenido, m.pedido_id, m.fecha_creacion
    from public.mensajes_conversacion m
    where m.id = v_mensaje_id;
    return;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_usuario_id::text, 0));

  select m.id, m.conversacion_id, m.fecha_creacion
  into v_mensaje_id, v_conversacion_id, v_mensaje_fecha
  from public.mensajes_conversacion m
  where m.remitente_usuario_id = v_usuario_id
    and m.clave_idempotencia = p_clave_idempotencia;

  if found then
    return query
    select m.id, m.conversacion_id, m.remitente_usuario_id, m.remitente_tipo,
      m.remitente_nombre_snapshot, m.contenido, m.pedido_id, m.fecha_creacion
    from public.mensajes_conversacion m
    where m.id = v_mensaje_id;
    return;
  end if;

  select count(*)
  into v_mensajes_recientes
  from public.mensajes_conversacion m
  where m.remitente_usuario_id = v_usuario_id
    and m.fecha_creacion >= clock_timestamp() - interval '1 minute';

  if v_mensajes_recientes >= 10 then
    raise exception 'CHAT_LIMITE_DE_MENSAJES';
  end if;

  if p_pedido_id is not null and not exists (
    select 1
    from public.pedidos p
    where p.id = p_pedido_id
      and p.cliente_id = v_cliente_id
  ) then
    raise exception 'CHAT_PEDIDO_INVALIDO';
  end if;

  insert into public.conversaciones_cliente (cliente_id)
  values (v_cliente_id)
  on conflict (cliente_id) do nothing;

  select cc.id
  into v_conversacion_id
  from public.conversaciones_cliente cc
  where cc.cliente_id = v_cliente_id
  for update;

  insert into public.mensajes_conversacion (
    conversacion_id,
    remitente_usuario_id,
    remitente_tipo,
    remitente_nombre_snapshot,
    contenido,
    pedido_id,
    clave_idempotencia,
    fecha_creacion
  ) values (
    v_conversacion_id,
    v_usuario_id,
    v_remitente_tipo,
    v_remitente_nombre,
    v_contenido,
    p_pedido_id,
    p_clave_idempotencia,
    clock_timestamp()
  )
  returning public.mensajes_conversacion.id,
    public.mensajes_conversacion.fecha_creacion
  into v_mensaje_id, v_mensaje_fecha;

  update public.conversaciones_cliente cc
  set ultimo_mensaje_en = v_mensaje_fecha,
      ultimo_mensaje_preview = left(regexp_replace(v_contenido, '[[:space:]]+', ' ', 'g'), 160),
      ultimo_remitente_tipo = v_remitente_tipo
  where cc.id = v_conversacion_id;

  return query
  select m.id, m.conversacion_id, m.remitente_usuario_id, m.remitente_tipo,
    m.remitente_nombre_snapshot, m.contenido, m.pedido_id, m.fecha_creacion
  from public.mensajes_conversacion m
  where m.id = v_mensaje_id;
end;
$$;

alter function public.enviar_mensaje_conversacion(uuid, text, uuid, uuid) owner to postgres;
revoke all on function public.enviar_mensaje_conversacion(uuid, text, uuid, uuid) from public, anon, authenticated;
grant execute on function public.enviar_mensaje_conversacion(uuid, text, uuid, uuid) to authenticated;
