-- Ejecutar manualmente como postgres. La gestión de cambios queda pendiente
-- hasta ejecutar gestion_administradores_configurar_principal.sql.
begin;

create schema administracion_privada authorization postgres;
revoke all on schema administracion_privada from public, anon, authenticated, service_role;

-- La referencia compuesta protege el rol incluso ante otra transacción con
-- una instantánea anterior a la configuración inicial.
alter table public.perfiles add constraint perfiles_usuario_rol_gestion_admin unique (usuario_id, rol);

create table administracion_privada.administrador_principal (
  unico boolean primary key default true check (unico),
  usuario_id uuid not null,
  rol public.rol_perfil not null default 'admin' check (rol = 'admin'),
  configurado_en timestamptz not null default now(),
  foreign key (usuario_id, rol) references public.perfiles(usuario_id, rol) on delete restrict on update restrict
);

create table administracion_privada.historial_administradores (
  actor_id uuid not null,
  clave uuid not null,
  usuario_id uuid not null,
  rol_anterior public.rol_perfil not null,
  rol_solicitado public.rol_perfil not null,
  registrado_en timestamptz not null default clock_timestamp(),
  primary key (actor_id, clave)
);

alter table administracion_privada.administrador_principal enable row level security;
alter table administracion_privada.historial_administradores enable row level security;
revoke all on all tables in schema administracion_privada from public, anon, authenticated, service_role;

create function public.leer_gestion_administradores(p_busqueda text default '')
returns jsonb language plpgsql stable security definer set search_path = pg_catalog
as $$
declare
  consulta text := lower(btrim(coalesce(p_busqueda, '')));
  principal uuid;
begin
  if auth.uid() is null or not public.es_admin() then
    raise exception 'NO_AUTORIZADO' using errcode = '42501';
  end if;
  if length(consulta) > 100 then raise exception 'BUSQUEDA_INVALIDA'; end if;

  select usuario_id into principal from administracion_privada.administrador_principal;
  return jsonb_build_object(
    'configurado', principal is not null,
    'administradores', coalesce((
      select jsonb_agg(jsonb_build_object(
        'usuario_id', p.usuario_id, 'nombre', p.nombre, 'correo', u.email,
        'principal', coalesce(p.usuario_id = principal, false),
        'propio', p.usuario_id = auth.uid()
      ) order by (p.usuario_id is distinct from principal), lower(coalesce(p.nombre, u.email, '')), p.usuario_id)
      from public.perfiles p
      join auth.users u on u.id = p.usuario_id
      where p.rol = 'admin'
    ), '[]'::jsonb),
    'usuarios', coalesce((
      select jsonb_agg(to_jsonb(c) order by lower(coalesce(c.nombre, c.correo, '')), c.usuario_id)
      from (
        select p.usuario_id, p.nombre, u.email as correo
        from public.perfiles p
        join auth.users u on u.id = p.usuario_id
        where principal is not null and p.rol = 'cliente' and length(consulta) >= 2
          and (strpos(lower(coalesce(p.nombre, '')), consulta) > 0
            or strpos(lower(coalesce(u.email, '')), consulta) > 0)
        order by lower(coalesce(p.nombre, u.email, '')), p.usuario_id
        limit 30
      ) c
    ), '[]'::jsonb)
  );
end;
$$;

create function public.actualizar_permiso_administrador(p_usuario uuid, p_activo boolean, p_clave uuid)
returns void language plpgsql volatile security definer set search_path = pg_catalog
as $$
declare
  actor uuid := auth.uid();
  principal uuid;
  anterior public.rol_perfil;
  solicitado public.rol_perfil;
  operacion administracion_privada.historial_administradores%rowtype;
begin
  if actor is null or not public.es_admin() then
    raise exception 'NO_AUTORIZADO' using errcode = '42501';
  end if;
  if p_usuario is null or p_activo is null or p_clave is null then
    raise exception 'OPERACION_INVALIDA';
  end if;
  if current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'AISLAMIENTO_NO_COMPATIBLE';
  end if;

  -- Serializa cambios de rol, altas/bajas de perfiles y la configuración inicial.
  -- La lectura posterior al lock vuelve a comprobar el permiso del actor.
  lock table public.perfiles in share row exclusive mode;
  if not public.es_admin() then raise exception 'NO_AUTORIZADO' using errcode = '42501'; end if;

  select usuario_id into principal from administracion_privada.administrador_principal;
  if principal is null then raise exception 'ADMINISTRADOR_PRINCIPAL_PENDIENTE'; end if;
  if p_usuario = principal then raise exception 'ADMINISTRADOR_PRINCIPAL_PROTEGIDO'; end if;
  if not p_activo and p_usuario = actor then raise exception 'AUTORREVOCACION_PROHIBIDA'; end if;

  solicitado := case when p_activo then 'admin'::public.rol_perfil else 'cliente'::public.rol_perfil end;
  select * into operacion from administracion_privada.historial_administradores
    where actor_id = actor and clave = p_clave;
  if found then
    if operacion.usuario_id <> p_usuario or operacion.rol_solicitado <> solicitado then
      raise exception 'CLAVE_IDEMPOTENCIA_EN_USO';
    end if;
    return;
  end if;

  select rol into anterior from public.perfiles where usuario_id = p_usuario;
  if not found then raise exception 'USUARIO_INVALIDO'; end if;

  if anterior <> solicitado then
    update public.perfiles set rol = solicitado where usuario_id = p_usuario;
  end if;
  insert into administracion_privada.historial_administradores
    (actor_id, clave, usuario_id, rol_anterior, rol_solicitado)
    values (actor, p_clave, p_usuario, anterior, solicitado);
end;
$$;

revoke all on function public.leer_gestion_administradores(text),
  public.actualizar_permiso_administrador(uuid, boolean, uuid) from public, anon, authenticated, service_role;
grant execute on function public.leer_gestion_administradores(text),
  public.actualizar_permiso_administrador(uuid, boolean, uuid) to authenticated;

commit;
