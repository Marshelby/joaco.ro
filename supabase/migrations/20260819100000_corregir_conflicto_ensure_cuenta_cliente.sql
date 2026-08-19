-- C1: evita la ambigüedad PL/pgSQL entre la columna de salida usuario_id
-- y los objetivos ON CONFLICT de perfiles/clientes.

create or replace function public.ensure_cuenta_cliente_actual()
returns table (
  usuario_id uuid,
  rol public.rol_perfil,
  cliente_id uuid,
  cliente_activo boolean,
  cliente_creado boolean,
  perfil_reparado boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario_id uuid := auth.uid();
  v_usuario auth.users%rowtype;
  v_perfil public.perfiles%rowtype;
  v_cliente public.clientes%rowtype;
  v_nombre_metadata text;
  v_nombre_cliente text;
  v_email_cliente text;
  v_cliente_creado boolean := false;
  v_perfil_reparado boolean := false;
  v_filas_insertadas integer := 0;
begin
  if v_usuario_id is null then
    raise exception 'NO_AUTORIZADO';
  end if;

  select * into v_usuario
  from auth.users u
  where u.id = v_usuario_id
  for update;

  if not found then
    raise exception 'PERFIL_INVALIDO';
  end if;

  v_nombre_metadata := nullif(btrim(coalesce(
    v_usuario.raw_user_meta_data ->> 'full_name',
    v_usuario.raw_user_meta_data ->> 'name'
  )), '');

  select * into v_perfil
  from public.perfiles p
  where p.usuario_id = v_usuario_id
  for update;

  if not found then
    insert into public.perfiles (usuario_id, rol, nombre)
    values (v_usuario_id, 'cliente', v_nombre_metadata)
    on conflict on constraint perfiles_pkey do nothing;

    get diagnostics v_filas_insertadas = row_count;
    v_perfil_reparado := v_filas_insertadas = 1;

    select * into v_perfil
    from public.perfiles p
    where p.usuario_id = v_usuario_id
    for update;

    if not found then
      raise exception 'PERFIL_INVALIDO';
    end if;
  end if;

  if v_perfil.rol = 'admin' then
    return query select v_usuario_id, v_perfil.rol, null::uuid, null::boolean, false, v_perfil_reparado;
    return;
  end if;

  if v_perfil.rol <> 'cliente' then
    raise exception 'PERFIL_INVALIDO';
  end if;

  select * into v_cliente
  from public.clientes c
  where c.usuario_id = v_usuario_id
  for update;

  if found then
    if not v_cliente.activo then
      raise exception 'CLIENTE_INACTIVO';
    end if;

    return query select v_usuario_id, v_perfil.rol, v_cliente.id, v_cliente.activo, false, v_perfil_reparado;
    return;
  end if;

  v_nombre_cliente := coalesce(
    nullif(btrim(v_perfil.nombre), ''),
    v_nombre_metadata,
    nullif(btrim(split_part(coalesce(v_usuario.email, ''), '@', 1)), ''),
    'Cliente'
  );
  v_email_cliente := case when v_usuario.email_confirmed_at is not null then v_usuario.email else null end;

  -- Nunca se consulta clientes.email: un correo coincidente no autoriza un vínculo B2B.
  insert into public.clientes (usuario_id, nombre, email, telefono, activo, observaciones)
  values (v_usuario_id, v_nombre_cliente, v_email_cliente, null, true, null)
  on conflict on constraint clientes_usuario_id_key do nothing
  returning * into v_cliente;

  get diagnostics v_filas_insertadas = row_count;
  v_cliente_creado := v_filas_insertadas = 1;

  if not v_cliente_creado then
    select * into v_cliente
    from public.clientes c
    where c.usuario_id = v_usuario_id
    for update;

    if not found then
      raise exception 'PERFIL_INVALIDO';
    end if;
  end if;

  if not v_cliente.activo then
    raise exception 'CLIENTE_INACTIVO';
  end if;

  return query select v_usuario_id, v_perfil.rol, v_cliente.id, v_cliente.activo, v_cliente_creado, v_perfil_reparado;
end;
$$;

alter function public.ensure_cuenta_cliente_actual() owner to postgres;

revoke all on function public.ensure_cuenta_cliente_actual() from public, anon, authenticated;
grant execute on function public.ensure_cuenta_cliente_actual() to authenticated;
