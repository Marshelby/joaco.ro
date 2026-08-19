-- C5: vínculo B2B explícito, auditable y sin matching automático por correo.

create extension if not exists pgcrypto;

create table public.invitaciones_acceso_cliente (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete restrict,
  correo_destino text not null check (correo_destino = lower(btrim(correo_destino)) and btrim(correo_destino) <> ''),
  token_hash text not null unique,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'aceptada', 'revocada', 'expirada')),
  creada_por uuid references auth.users(id) on delete set null,
  fecha_creacion timestamptz not null default now(),
  fecha_actualizacion timestamptz not null default now(),
  fecha_expiracion timestamptz not null default (now() + interval '7 days'),
  fecha_aceptacion timestamptz,
  aceptada_por uuid references auth.users(id) on delete set null,
  cliente_previo_id uuid references public.clientes(id) on delete set null,
  constraint invitaciones_acceso_cliente_fechas_validas check (fecha_expiracion > fecha_creacion)
);

create unique index invitaciones_acceso_cliente_una_pendiente_por_cliente
  on public.invitaciones_acceso_cliente (cliente_id)
  where estado = 'pendiente';

create index invitaciones_acceso_cliente_cliente_id_idx
  on public.invitaciones_acceso_cliente (cliente_id, fecha_creacion desc);

create trigger actualizar_invitaciones_acceso_cliente_fecha_actualizacion
before update on public.invitaciones_acceso_cliente
for each row execute function public.actualizar_fecha_actualizacion();

alter table public.invitaciones_acceso_cliente enable row level security;

create function public.crear_invitacion_acceso_cliente_administrativa(
  p_cliente_id uuid,
  p_correo_destino text
)
returns table (
  invitacion_id uuid,
  token text,
  fecha_expiracion timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cliente public.clientes%rowtype;
  v_correo_destino text := lower(btrim(coalesce(p_correo_destino, '')));
  v_token text;
  v_token_hash text;
  v_invitacion_id uuid;
  v_fecha_expiracion timestamptz := now() + interval '7 days';
begin
  if not public.es_admin() then
    raise exception 'NO_AUTORIZADO';
  end if;

  if p_cliente_id is null or v_correo_destino !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'CORREO_INVALIDO';
  end if;

  select * into v_cliente
  from public.clientes c
  where c.id = p_cliente_id
  for update;

  if not found then
    raise exception 'CLIENTE_NO_ENCONTRADO';
  end if;
  if not v_cliente.activo then
    raise exception 'CLIENTE_INACTIVO';
  end if;
  if v_cliente.usuario_id is not null then
    raise exception 'CLIENTE_YA_VINCULADO';
  end if;

  update public.invitaciones_acceso_cliente i
  set estado = case when i.fecha_expiracion <= now() then 'expirada' else 'revocada' end
  where i.cliente_id = p_cliente_id
    and i.estado = 'pendiente';

  v_token := encode(gen_random_bytes(32), 'hex');
  v_token_hash := encode(digest(v_token, 'sha256'), 'hex');

  insert into public.invitaciones_acceso_cliente (
    cliente_id, correo_destino, token_hash, estado, creada_por, fecha_expiracion
  ) values (
    p_cliente_id, v_correo_destino, v_token_hash, 'pendiente', auth.uid(), v_fecha_expiracion
  ) returning id into v_invitacion_id;

  return query select v_invitacion_id, v_token, v_fecha_expiracion;
end;
$$;

create function public.revocar_invitacion_acceso_cliente_administrativa(p_invitacion_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invitacion public.invitaciones_acceso_cliente%rowtype;
begin
  if not public.es_admin() then
    raise exception 'NO_AUTORIZADO';
  end if;

  select * into v_invitacion
  from public.invitaciones_acceso_cliente i
  where i.id = p_invitacion_id
  for update;

  if not found then
    raise exception 'INVITACION_NO_ENCONTRADA';
  end if;
  if v_invitacion.estado <> 'pendiente' then
    raise exception 'INVITACION_NO_DISPONIBLE';
  end if;

  update public.invitaciones_acceso_cliente
  set estado = 'revocada'
  where id = p_invitacion_id;
end;
$$;

create function public.obtener_invitacion_acceso_cliente_administrativa(p_cliente_id uuid)
returns table (
  invitacion_id uuid,
  correo_destino text,
  estado text,
  fecha_creacion timestamptz,
  fecha_expiracion timestamptz,
  fecha_aceptacion timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.es_admin() then
    raise exception 'NO_AUTORIZADO';
  end if;

  return query
  select i.id,
    i.correo_destino,
    case when i.estado = 'pendiente' and i.fecha_expiracion <= now() then 'expirada' else i.estado end,
    i.fecha_creacion,
    i.fecha_expiracion,
    i.fecha_aceptacion
  from public.invitaciones_acceso_cliente i
  where i.cliente_id = p_cliente_id
  order by i.fecha_creacion desc
  limit 1;
end;
$$;

create function public.aceptar_invitacion_acceso_cliente(p_token text)
returns table (
  cliente_id uuid,
  estado text,
  ya_aceptada boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario_id uuid := auth.uid();
  v_usuario auth.users%rowtype;
  v_perfil public.perfiles%rowtype;
  v_invitacion public.invitaciones_acceso_cliente%rowtype;
  v_cliente_b2b public.clientes%rowtype;
  v_cliente_actual public.clientes%rowtype;
  v_cliente_previo_id uuid := null;
  v_token_hash text;
begin
  if v_usuario_id is null then
    raise exception 'NO_AUTORIZADO';
  end if;
  if p_token is null or btrim(p_token) !~ '^[a-f0-9]{64}$' then
    raise exception 'INVITACION_INVALIDA';
  end if;

  select * into v_usuario
  from auth.users u
  where u.id = v_usuario_id
  for update;
  if not found or v_usuario.email is null or v_usuario.email_confirmed_at is null then
    raise exception 'CORREO_NO_VERIFICADO';
  end if;

  select * into v_perfil
  from public.perfiles p
  where p.usuario_id = v_usuario_id
  for update;
  if not found or v_perfil.rol <> 'cliente' then
    raise exception 'NO_AUTORIZADO';
  end if;

  v_token_hash := encode(digest(lower(btrim(p_token)), 'sha256'), 'hex');
  select * into v_invitacion
  from public.invitaciones_acceso_cliente i
  where i.token_hash = v_token_hash
  for update;
  if not found then
    raise exception 'INVITACION_INVALIDA';
  end if;

  select * into v_cliente_b2b
  from public.clientes c
  where c.id = v_invitacion.cliente_id
  for update;
  if not found then
    raise exception 'CLIENTE_NO_ENCONTRADO';
  end if;

  if v_invitacion.estado = 'aceptada' then
    if v_invitacion.aceptada_por = v_usuario_id and v_cliente_b2b.usuario_id = v_usuario_id then
      return query select v_cliente_b2b.id, 'aceptada', true;
      return;
    end if;
    raise exception 'INVITACION_NO_DISPONIBLE';
  end if;
  if v_invitacion.estado = 'revocada' then
    raise exception 'INVITACION_REVOCADA';
  end if;
  if v_invitacion.estado = 'expirada' or v_invitacion.fecha_expiracion <= now() then
    raise exception 'INVITACION_EXPIRADA';
  end if;
  if v_invitacion.estado <> 'pendiente' then
    raise exception 'INVITACION_NO_DISPONIBLE';
  end if;
  if lower(v_usuario.email) <> v_invitacion.correo_destino then
    raise exception 'CORREO_NO_COINCIDE';
  end if;
  if not v_cliente_b2b.activo then
    raise exception 'CLIENTE_INACTIVO';
  end if;
  if v_cliente_b2b.usuario_id is not null then
    raise exception 'CLIENTE_YA_VINCULADO';
  end if;

  select * into v_cliente_actual
  from public.clientes c
  where c.usuario_id = v_usuario_id
  for update;

  if found and v_cliente_actual.id <> v_cliente_b2b.id then
    if exists (select 1 from public.direcciones_cliente d where d.cliente_id = v_cliente_actual.id)
      or exists (select 1 from public.pedidos p where p.cliente_id = v_cliente_actual.id)
      or exists (select 1 from public.pagos p where p.cliente_id = v_cliente_actual.id)
      or exists (select 1 from public.ajustes_cuenta_cliente a where a.cliente_id = v_cliente_actual.id) then
      raise exception 'CUENTA_CLIENTE_EXISTENTE_CON_HISTORIAL';
    end if;

    update public.clientes
    set usuario_id = null
    where id = v_cliente_actual.id;
    v_cliente_previo_id := v_cliente_actual.id;
  end if;

  update public.clientes
  set usuario_id = v_usuario_id
  where id = v_cliente_b2b.id;

  update public.invitaciones_acceso_cliente
  set estado = 'revocada'
  where cliente_id = v_cliente_b2b.id
    and estado = 'pendiente'
    and id <> v_invitacion.id;

  update public.invitaciones_acceso_cliente
  set estado = 'aceptada',
    fecha_aceptacion = now(),
    aceptada_por = v_usuario_id,
    cliente_previo_id = v_cliente_previo_id
  where id = v_invitacion.id;

  return query select v_cliente_b2b.id, 'aceptada', false;
end;
$$;

alter function public.crear_invitacion_acceso_cliente_administrativa(uuid, text) owner to postgres;
alter function public.revocar_invitacion_acceso_cliente_administrativa(uuid) owner to postgres;
alter function public.obtener_invitacion_acceso_cliente_administrativa(uuid) owner to postgres;
alter function public.aceptar_invitacion_acceso_cliente(text) owner to postgres;

revoke all on table public.invitaciones_acceso_cliente from public, anon, authenticated;
revoke all on function public.crear_invitacion_acceso_cliente_administrativa(uuid, text), public.revocar_invitacion_acceso_cliente_administrativa(uuid), public.obtener_invitacion_acceso_cliente_administrativa(uuid), public.aceptar_invitacion_acceso_cliente(text) from public, anon, authenticated;
grant execute on function public.crear_invitacion_acceso_cliente_administrativa(uuid, text), public.revocar_invitacion_acceso_cliente_administrativa(uuid), public.obtener_invitacion_acceso_cliente_administrativa(uuid), public.aceptar_invitacion_acceso_cliente(text) to authenticated;
