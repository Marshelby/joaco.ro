-- Operaciones administrativas atómicas para las asignaciones del inicio.

begin;

create or replace function public.agregar_producto_seccion_inicio_administrativa(
  p_seccion_slug text,
  p_producto_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_orden integer;
  v_asignacion_id uuid;
begin
  if not public.es_admin() then raise exception 'NO_AUTORIZADO'; end if;
  if p_seccion_slug not in ('featured', 'best-sellers', 'opportunities', 'new-arrivals') then
    raise exception 'SECCION_INICIO_INVALIDA';
  end if;
  if p_producto_id is null then raise exception 'PRODUCTO_INVALIDO'; end if;

  perform pg_advisory_xact_lock(hashtext('secciones_inicio_productos'));

  if not exists (
    select 1 from public.productos
    where id = p_producto_id and activo and disponible
  ) then
    raise exception 'PRODUCTO_NO_DISPONIBLE';
  end if;

  if exists (
    select 1 from public.secciones_inicio_productos
    where seccion_slug = p_seccion_slug and producto_id = p_producto_id
  ) then
    raise exception 'PRODUCTO_YA_ASIGNADO';
  end if;

  select coalesce(max(orden), 0) + 1
  into v_orden
  from public.secciones_inicio_productos
  where seccion_slug = p_seccion_slug;

  insert into public.secciones_inicio_productos (seccion_slug, producto_id, orden)
  values (p_seccion_slug, p_producto_id, v_orden)
  returning id into v_asignacion_id;

  return v_asignacion_id;
end;
$$;

create or replace function public.quitar_producto_seccion_inicio_administrativa(
  p_asignacion_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seccion_slug text;
  v_orden integer;
begin
  if not public.es_admin() then raise exception 'NO_AUTORIZADO'; end if;
  if p_asignacion_id is null then raise exception 'ASIGNACION_INEXISTENTE'; end if;

  perform pg_advisory_xact_lock(hashtext('secciones_inicio_productos'));

  select seccion_slug, orden
  into v_seccion_slug, v_orden
  from public.secciones_inicio_productos
  where id = p_asignacion_id
  for update;

  if not found then raise exception 'ASIGNACION_INEXISTENTE'; end if;

  delete from public.secciones_inicio_productos where id = p_asignacion_id;

  update public.secciones_inicio_productos
  set orden = orden + 1000000
  where seccion_slug = v_seccion_slug and orden > v_orden;

  update public.secciones_inicio_productos
  set orden = orden - 1000001
  where seccion_slug = v_seccion_slug and orden > 1000000;
end;
$$;

create or replace function public.mover_producto_seccion_inicio_administrativa(
  p_asignacion_id uuid,
  p_direccion text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seccion_slug text;
  v_orden_origen integer;
  v_orden_destino integer;
  v_asignacion_destino uuid;
begin
  if not public.es_admin() then raise exception 'NO_AUTORIZADO'; end if;
  if p_asignacion_id is null then raise exception 'ASIGNACION_INEXISTENTE'; end if;
  if p_direccion not in ('arriba', 'abajo') then raise exception 'DIRECCION_INVALIDA'; end if;

  perform pg_advisory_xact_lock(hashtext('secciones_inicio_productos'));

  select seccion_slug, orden
  into v_seccion_slug, v_orden_origen
  from public.secciones_inicio_productos
  where id = p_asignacion_id
  for update;

  if not found then raise exception 'ASIGNACION_INEXISTENTE'; end if;

  v_orden_destino := v_orden_origen + case when p_direccion = 'arriba' then -1 else 1 end;

  select id
  into v_asignacion_destino
  from public.secciones_inicio_productos
  where seccion_slug = v_seccion_slug and orden = v_orden_destino
  for update;

  if not found then return false; end if;

  update public.secciones_inicio_productos
  set orden = v_orden_origen + 1000000
  where id = p_asignacion_id;

  update public.secciones_inicio_productos
  set orden = v_orden_origen
  where id = v_asignacion_destino;

  update public.secciones_inicio_productos
  set orden = v_orden_destino
  where id = p_asignacion_id;

  return true;
end;
$$;

revoke all on function public.agregar_producto_seccion_inicio_administrativa(text, uuid) from public, anon;
revoke all on function public.quitar_producto_seccion_inicio_administrativa(uuid) from public, anon;
revoke all on function public.mover_producto_seccion_inicio_administrativa(uuid, text) from public, anon;

grant execute on function public.agregar_producto_seccion_inicio_administrativa(text, uuid) to authenticated;
grant execute on function public.quitar_producto_seccion_inicio_administrativa(uuid) to authenticated;
grant execute on function public.mover_producto_seccion_inicio_administrativa(uuid, text) to authenticated;

commit;
