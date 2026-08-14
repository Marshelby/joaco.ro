-- Autogestión acotada de datos comerciales propios. Las funciones resuelven
-- cliente y ownership desde auth.uid(); no aceptan cliente_id desde el navegador.

create or replace function public.actualizar_perfil_cliente(
  p_nombre text,
  p_telefono text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cliente_id uuid;
  v_nombre text := nullif(btrim(p_nombre), '');
  v_telefono text := nullif(btrim(p_telefono), '');
begin
  if auth.uid() is null then
    raise exception 'NO_AUTORIZADO';
  end if;

  if v_nombre is null then
    raise exception 'NOMBRE_REQUERIDO';
  end if;

  select id into v_cliente_id
  from public.clientes
  where usuario_id = auth.uid() and activo = true;

  if v_cliente_id is null then
    raise exception 'CLIENTE_NO_ENCONTRADO';
  end if;

  update public.clientes
  set nombre = v_nombre,
      telefono = v_telefono
  where id = v_cliente_id;
end;
$$;

create or replace function public.guardar_direccion_cliente(
  p_direccion_id uuid,
  p_nombre text default null,
  p_destinatario text default null,
  p_telefono_contacto text default null,
  p_direccion text default null,
  p_comuna text default null,
  p_region text default null,
  p_referencia text default null,
  p_es_principal boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cliente_id uuid;
  v_direccion_id uuid;
  v_direccion text := nullif(btrim(p_direccion), '');
  v_comuna text := nullif(btrim(p_comuna), '');
  v_region text := nullif(btrim(p_region), '');
begin
  if auth.uid() is null then
    raise exception 'NO_AUTORIZADO';
  end if;

  if v_direccion is null or v_comuna is null or v_region is null then
    raise exception 'DIRECCION_INVALIDA';
  end if;

  select id into v_cliente_id
  from public.clientes
  where usuario_id = auth.uid() and activo = true;

  if v_cliente_id is null then
    raise exception 'CLIENTE_NO_ENCONTRADO';
  end if;

  if p_direccion_id is not null then
    select id into v_direccion_id
    from public.direcciones_cliente
    where id = p_direccion_id
      and cliente_id = v_cliente_id
      and activa = true;

    if v_direccion_id is null then
      raise exception 'DIRECCION_NO_ENCONTRADA';
    end if;
  end if;

  if coalesce(p_es_principal, false) then
    update public.direcciones_cliente
    set es_principal = false
    where cliente_id = v_cliente_id
      and activa = true
      and (p_direccion_id is null or id <> p_direccion_id);
  end if;

  if p_direccion_id is null then
    insert into public.direcciones_cliente (
      cliente_id, nombre, destinatario, telefono_contacto, direccion, comuna,
      region, referencia, es_principal
    ) values (
      v_cliente_id, nullif(btrim(p_nombre), ''), nullif(btrim(p_destinatario), ''),
      nullif(btrim(p_telefono_contacto), ''), v_direccion, v_comuna, v_region,
      nullif(btrim(p_referencia), ''), coalesce(p_es_principal, false)
    ) returning id into v_direccion_id;
  else
    update public.direcciones_cliente
    set nombre = nullif(btrim(p_nombre), ''),
        destinatario = nullif(btrim(p_destinatario), ''),
        telefono_contacto = nullif(btrim(p_telefono_contacto), ''),
        direccion = v_direccion,
        comuna = v_comuna,
        region = v_region,
        referencia = nullif(btrim(p_referencia), ''),
        es_principal = coalesce(p_es_principal, false)
    where id = v_direccion_id;
  end if;

  return v_direccion_id;
end;
$$;

create or replace function public.desactivar_direccion_cliente(
  p_direccion_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cliente_id uuid;
begin
  if auth.uid() is null then
    raise exception 'NO_AUTORIZADO';
  end if;

  select id into v_cliente_id
  from public.clientes
  where usuario_id = auth.uid() and activo = true;

  if v_cliente_id is null then
    raise exception 'CLIENTE_NO_ENCONTRADO';
  end if;

  update public.direcciones_cliente
  set activa = false,
      es_principal = false
  where id = p_direccion_id
    and cliente_id = v_cliente_id
    and activa = true;

  if not found then
    raise exception 'DIRECCION_NO_ENCONTRADA';
  end if;
end;
$$;

revoke all on function public.actualizar_perfil_cliente(text, text) from public, anon, authenticated;
revoke all on function public.guardar_direccion_cliente(uuid, text, text, text, text, text, text, text, boolean) from public, anon, authenticated;
revoke all on function public.desactivar_direccion_cliente(uuid) from public, anon, authenticated;

grant execute on function public.actualizar_perfil_cliente(text, text) to authenticated;
grant execute on function public.guardar_direccion_cliente(uuid, text, text, text, text, text, text, text, boolean) to authenticated;
grant execute on function public.desactivar_direccion_cliente(uuid) to authenticated;
