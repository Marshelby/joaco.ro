-- Chat V1 cliente <-> Hidro Leufú.
-- Las escrituras se concentran en RPCs SECURITY DEFINER; las tablas sólo
-- exponen lectura bajo RLS a participantes autorizados.

create table public.conversaciones_cliente (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete restrict,
  ultimo_mensaje_en timestamptz,
  ultimo_mensaje_preview text,
  ultimo_remitente_tipo text,
  cliente_ultimo_leido_en timestamptz,
  admin_ultimo_leido_en timestamptz,
  fecha_creacion timestamptz not null default now(),
  fecha_actualizacion timestamptz not null default now(),
  constraint conversaciones_cliente_cliente_unico unique (cliente_id),
  constraint conversaciones_cliente_ultimo_remitente_tipo_valido check (
    ultimo_remitente_tipo is null
    or ultimo_remitente_tipo in ('cliente', 'admin')
  )
);

create table public.mensajes_conversacion (
  id uuid primary key default gen_random_uuid(),
  conversacion_id uuid not null references public.conversaciones_cliente(id) on delete restrict,
  remitente_usuario_id uuid not null references auth.users(id) on delete restrict,
  remitente_tipo text not null,
  remitente_nombre_snapshot text not null,
  contenido text not null,
  pedido_id uuid references public.pedidos(id) on delete restrict,
  clave_idempotencia uuid not null,
  fecha_creacion timestamptz not null default now(),
  constraint mensajes_conversacion_remitente_tipo_valido check (
    remitente_tipo in ('cliente', 'admin')
  ),
  constraint mensajes_conversacion_contenido_valido check (
    btrim(contenido) <> ''
    and char_length(btrim(contenido)) <= 2000
  ),
  constraint mensajes_conversacion_remitente_idempotencia_unica unique (
    remitente_usuario_id,
    clave_idempotencia
  )
);

create index conversaciones_cliente_ultimo_mensaje_en_idx
  on public.conversaciones_cliente (ultimo_mensaje_en desc);

create index mensajes_conversacion_conversacion_fecha_idx
  on public.mensajes_conversacion (conversacion_id, fecha_creacion desc, id desc);

create trigger actualizar_conversaciones_cliente_fecha_actualizacion
before update on public.conversaciones_cliente
for each row execute function public.actualizar_fecha_actualizacion();

alter table public.conversaciones_cliente enable row level security;
alter table public.mensajes_conversacion enable row level security;

revoke all on public.conversaciones_cliente, public.mensajes_conversacion from public, anon, authenticated;
grant select on public.conversaciones_cliente, public.mensajes_conversacion to authenticated;

create policy conversaciones_cliente_lectura_autorizada
  on public.conversaciones_cliente
  for select
  to authenticated
  using (
    public.es_admin()
    or exists (
      select 1
      from public.clientes c
      where c.id = conversaciones_cliente.cliente_id
        and c.usuario_id = auth.uid()
    )
  );

create policy conversaciones_cliente_administracion
  on public.conversaciones_cliente
  for all
  to authenticated
  using (public.es_admin())
  with check (public.es_admin());

create policy mensajes_conversacion_lectura_autorizada
  on public.mensajes_conversacion
  for select
  to authenticated
  using (
    public.es_admin()
    or exists (
      select 1
      from public.conversaciones_cliente cc
      join public.clientes c on c.id = cc.cliente_id
      where cc.id = mensajes_conversacion.conversacion_id
        and c.usuario_id = auth.uid()
    )
  );

create policy mensajes_conversacion_administracion
  on public.mensajes_conversacion
  for all
  to authenticated
  using (public.es_admin())
  with check (public.es_admin());

create function public.enviar_mensaje_conversacion(
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

  -- La consulta antes del límite permite que un reintento no cuente como nuevo mensaje.
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

  -- Serializa límite e idempotencia por autor; evita que dos envíos simultáneos excedan 10/minuto.
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
  returning id, fecha_creacion into v_mensaje_id, v_mensaje_fecha;

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

create function public.marcar_conversacion_leida(
  p_cliente_id uuid
)
returns table (
  conversacion_id uuid,
  leido_hasta timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario_id uuid := auth.uid();
  v_rol public.rol_perfil;
  v_cliente_id uuid;
  v_conversacion_id uuid;
  v_ultimo_mensaje_en timestamptz;
  v_leido_hasta timestamptz;
begin
  if v_usuario_id is null then
    raise exception 'CHAT_NO_AUTENTICADO';
  end if;

  select p.rol
  into v_rol
  from public.perfiles p
  where p.usuario_id = v_usuario_id;

  if not found or v_rol not in ('cliente'::public.rol_perfil, 'admin'::public.rol_perfil) then
    raise exception 'CHAT_ACTOR_INVALIDO';
  end if;

  if v_rol = 'cliente'::public.rol_perfil then
    select c.id
    into v_cliente_id
    from public.clientes c
    where c.usuario_id = v_usuario_id
      and c.activo = true;

    if not found then
      raise exception 'CHAT_CLIENTE_NO_DISPONIBLE';
    end if;

    if p_cliente_id is not null and p_cliente_id is distinct from v_cliente_id then
      raise exception 'CHAT_CLIENTE_DESTINO_INVALIDO';
    end if;
  else
    if p_cliente_id is null then
      raise exception 'CHAT_CLIENTE_REQUERIDO';
    end if;

    select c.id
    into v_cliente_id
    from public.clientes c
    where c.id = p_cliente_id;

    if not found then
      raise exception 'CHAT_CLIENTE_INEXISTENTE';
    end if;
  end if;

  select cc.id
  into v_conversacion_id
  from public.conversaciones_cliente cc
  where cc.cliente_id = v_cliente_id
  for update;

  if not found then
    raise exception 'CHAT_CONVERSACION_INEXISTENTE';
  end if;

  select max(m.fecha_creacion)
  into v_ultimo_mensaje_en
  from public.mensajes_conversacion m
  where m.conversacion_id = v_conversacion_id;

  if v_rol = 'cliente'::public.rol_perfil then
    update public.conversaciones_cliente cc
    set cliente_ultimo_leido_en = greatest(cc.cliente_ultimo_leido_en, v_ultimo_mensaje_en)
    where cc.id = v_conversacion_id
    returning cc.cliente_ultimo_leido_en into v_leido_hasta;
  else
    update public.conversaciones_cliente cc
    set admin_ultimo_leido_en = greatest(cc.admin_ultimo_leido_en, v_ultimo_mensaje_en)
    where cc.id = v_conversacion_id
    returning cc.admin_ultimo_leido_en into v_leido_hasta;
  end if;

  return query select v_conversacion_id, v_leido_hasta;
end;
$$;

alter function public.enviar_mensaje_conversacion(uuid, text, uuid, uuid) owner to postgres;
alter function public.marcar_conversacion_leida(uuid) owner to postgres;

revoke all on function public.enviar_mensaje_conversacion(uuid, text, uuid, uuid) from public, anon, authenticated;
revoke all on function public.marcar_conversacion_leida(uuid) from public, anon, authenticated;
grant execute on function public.enviar_mensaje_conversacion(uuid, text, uuid, uuid) to authenticated;
grant execute on function public.marcar_conversacion_leida(uuid) to authenticated;

-- Postgres Changes requiere que la tabla figure explícitamente en la publicación.
do $$
begin
  if not exists (
    select 1
    from pg_publication p
    where p.pubname = 'supabase_realtime'
  ) then
    execute 'create publication supabase_realtime';
  end if;

  if not exists (
    select 1
    from pg_publication_tables pt
    where pt.pubname = 'supabase_realtime'
      and pt.schemaname = 'public'
      and pt.tablename = 'mensajes_conversacion'
  ) then
    execute 'alter publication supabase_realtime add table public.mensajes_conversacion';
  end if;
end;
$$;
