-- Ejecutar como postgres después de las migraciones de secciones de inicio de 20260827.
begin;

create table public.secciones_inicio (
  slug text primary key default pg_catalog.gen_random_uuid()::text
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  nombre text not null check (char_length(btrim(nombre)) between 1 and 120),
  descripcion text check (char_length(descripcion) <= 500),
  icono text not null default 'estrella' check (icono in ('estrella', 'hoja', 'canasta', 'destellos')),
  activa boolean not null default true,
  orden integer not null check (orden >= 1),
  constraint secciones_inicio_orden_unico unique (orden) deferrable initially immediate
);

-- Conservar los textos, identificadores y orden de la portada pública.
insert into public.secciones_inicio (slug, nombre, descripcion, orden) values
  ('featured', 'Frescos de Hidro Leufú', 'Una selección prioritaria de productos hidropónicos.', 1),
  ('best-sellers', 'Hidropónicos', 'Frescos, seleccionados y preparados para abastecer tu negocio.', 2),
  ('opportunities', 'Más productos frescos', 'Encuentra productos para complementar tu pedido.', 3),
  ('new-arrivals', 'Recién seleccionados', 'Nuevos productos que se suman a nuestra selección.', 4);

alter table public.secciones_inicio_productos
  drop constraint secciones_inicio_productos_seccion_slug_check,
  drop constraint secciones_inicio_productos_seccion_orden_unico,
  add constraint secciones_inicio_productos_seccion_orden_unico
    unique (seccion_slug, orden) deferrable initially immediate,
  add constraint secciones_inicio_productos_seccion_fk
    foreign key (seccion_slug) references public.secciones_inicio(slug) on delete cascade;

alter table public.secciones_inicio owner to postgres;
alter table public.secciones_inicio enable row level security;
revoke all on table public.secciones_inicio from public, anon, authenticated;
grant select on table public.secciones_inicio to anon, authenticated;

create policy secciones_inicio_lectura_publica on public.secciones_inicio
  for select to anon, authenticated using (activa);
create policy secciones_inicio_lectura_admin on public.secciones_inicio
  for select to authenticated using ((select public.es_admin()));

drop policy secciones_inicio_productos_lectura_publica on public.secciones_inicio_productos;
drop policy secciones_inicio_productos_administracion on public.secciones_inicio_productos;

-- Las escrituras del gestor pasan por las RPC que comparten el bloqueo.
revoke insert, update, delete on public.secciones_inicio_productos from authenticated;
create policy secciones_inicio_productos_lectura_admin on public.secciones_inicio_productos
  for select to authenticated using ((select public.es_admin()));
create policy secciones_inicio_productos_lectura_publica on public.secciones_inicio_productos
  for select to anon, authenticated
  using (exists (
    select 1 from public.secciones_inicio s
    where s.slug = secciones_inicio_productos.seccion_slug and s.activa
  ));

create or replace function public.gestionar_seccion_inicio_administrativa(
  p_operacion text,
  p_slug text default null,
  p_nombre text default null,
  p_descripcion text default null,
  p_icono text default null,
  p_activa boolean default null,
  p_direccion text default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_orden integer;
  v_destino text;
  v_orden_destino integer;
begin
  if public.es_admin() is not true then raise exception 'NO_AUTORIZADO'; end if;

  -- Serializa cambios en la sección con las RPC existentes de sus asignaciones.
  perform pg_advisory_xact_lock(hashtext('secciones_inicio_productos'));

  if p_operacion in ('crear', 'editar') then
    if nullif(btrim(p_nombre), '') is null or char_length(btrim(p_nombre)) > 120 then
      raise exception 'NOMBRE_INVALIDO';
    end if;
    if char_length(btrim(p_descripcion)) > 500 then raise exception 'DESCRIPCION_INVALIDA'; end if;
    if p_icono is null or p_icono not in ('estrella', 'hoja', 'canasta', 'destellos') then
      raise exception 'ICONO_INVALIDO';
    end if;
  end if;

  if p_operacion = 'crear' then
    select coalesce(max(orden), 0) + 1 into v_orden from public.secciones_inicio;
    insert into public.secciones_inicio (nombre, descripcion, icono, orden)
    values (btrim(p_nombre), nullif(btrim(p_descripcion), ''), p_icono, v_orden);
    return;
  end if;

  select orden into v_orden from public.secciones_inicio where slug = p_slug;
  if not found then raise exception 'SECCION_INICIO_INVALIDA'; end if;

  case p_operacion
    when 'editar' then
      update public.secciones_inicio
      set nombre = btrim(p_nombre), descripcion = nullif(btrim(p_descripcion), ''), icono = p_icono
      where slug = p_slug;
    when 'visibilidad' then
      if p_activa is null then raise exception 'VISIBILIDAD_INVALIDA'; end if;
      update public.secciones_inicio set activa = p_activa where slug = p_slug;
    when 'eliminar' then
      -- La única cascada saliente elimina las asignaciones de la sección.
      delete from public.secciones_inicio where slug = p_slug;
    when 'mover' then
      if p_direccion = 'arriba' then
        select slug, orden into v_destino, v_orden_destino
        from public.secciones_inicio where orden < v_orden order by orden desc limit 1;
      elsif p_direccion = 'abajo' then
        select slug, orden into v_destino, v_orden_destino
        from public.secciones_inicio where orden > v_orden order by orden limit 1;
      else
        raise exception 'DIRECCION_INVALIDA';
      end if;
      if v_destino is null then raise exception 'SECCION_EN_EXTREMO'; end if;

      -- La restricción DEFERRABLE INITIALLY IMMEDIATE verifica al final del UPDATE.
      update public.secciones_inicio
      set orden = case when slug = p_slug then v_orden_destino else v_orden end
      where slug in (p_slug, v_destino);
    else
      raise exception 'OPERACION_INVALIDA';
  end case;
end;
$$;

-- Mantener las firmas y los resultados de las RPC de asignaciones.
create or replace function public.agregar_producto_seccion_inicio_administrativa(
  p_seccion_slug text,
  p_producto_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_orden integer;
  v_asignacion_id uuid;
begin
  if public.es_admin() is not true then raise exception 'NO_AUTORIZADO'; end if;
  if p_producto_id is null then raise exception 'PRODUCTO_INVALIDO'; end if;

  perform pg_advisory_xact_lock(hashtext('secciones_inicio_productos'));

  if not exists (select 1 from public.secciones_inicio where slug = p_seccion_slug) then
    raise exception 'SECCION_INICIO_INVALIDA';
  end if;
  if not exists (
    select 1 from public.productos where id = p_producto_id and activo and disponible
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
  into v_orden from public.secciones_inicio_productos where seccion_slug = p_seccion_slug;

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
set search_path = pg_catalog, pg_temp
as $$
declare
  v_seccion_slug text;
  v_orden integer;
begin
  if public.es_admin() is not true then raise exception 'NO_AUTORIZADO'; end if;
  if p_asignacion_id is null then raise exception 'ASIGNACION_INEXISTENTE'; end if;

  perform pg_advisory_xact_lock(hashtext('secciones_inicio_productos'));

  delete from public.secciones_inicio_productos
  where id = p_asignacion_id
  returning seccion_slug, orden into v_seccion_slug, v_orden;
  if not found then raise exception 'ASIGNACION_INEXISTENTE'; end if;

  update public.secciones_inicio_productos
  set orden = orden - 1
  where seccion_slug = v_seccion_slug and orden > v_orden;
end;
$$;

create or replace function public.mover_producto_seccion_inicio_administrativa(
  p_asignacion_id uuid,
  p_direccion text
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_seccion_slug text;
  v_orden_origen integer;
  v_orden_destino integer;
  v_asignacion_destino uuid;
begin
  if public.es_admin() is not true then raise exception 'NO_AUTORIZADO'; end if;
  if p_asignacion_id is null then raise exception 'ASIGNACION_INEXISTENTE'; end if;
  if p_direccion is null or p_direccion not in ('arriba', 'abajo') then
    raise exception 'DIRECCION_INVALIDA';
  end if;

  perform pg_advisory_xact_lock(hashtext('secciones_inicio_productos'));

  select seccion_slug, orden into v_seccion_slug, v_orden_origen
  from public.secciones_inicio_productos where id = p_asignacion_id;
  if not found then raise exception 'ASIGNACION_INEXISTENTE'; end if;

  if p_direccion = 'arriba' then
    select id, orden into v_asignacion_destino, v_orden_destino
    from public.secciones_inicio_productos
    where seccion_slug = v_seccion_slug and orden < v_orden_origen
    order by orden desc limit 1;
  else
    select id, orden into v_asignacion_destino, v_orden_destino
    from public.secciones_inicio_productos
    where seccion_slug = v_seccion_slug and orden > v_orden_origen
    order by orden limit 1;
  end if;
  if v_asignacion_destino is null then return false; end if;

  update public.secciones_inicio_productos
  set orden = case when id = p_asignacion_id then v_orden_destino else v_orden_origen end
  where id in (p_asignacion_id, v_asignacion_destino);

  return true;
end;
$$;

alter function public.gestionar_seccion_inicio_administrativa(text, text, text, text, text, boolean, text) owner to postgres;
alter function public.agregar_producto_seccion_inicio_administrativa(text, uuid) owner to postgres;
alter function public.quitar_producto_seccion_inicio_administrativa(uuid) owner to postgres;
alter function public.mover_producto_seccion_inicio_administrativa(uuid, text) owner to postgres;

revoke all on function
  public.gestionar_seccion_inicio_administrativa(text, text, text, text, text, boolean, text),
  public.agregar_producto_seccion_inicio_administrativa(text, uuid),
  public.quitar_producto_seccion_inicio_administrativa(uuid),
  public.mover_producto_seccion_inicio_administrativa(uuid, text)
  from public, anon, authenticated;

grant execute on function
  public.gestionar_seccion_inicio_administrativa(text, text, text, text, text, boolean, text),
  public.agregar_producto_seccion_inicio_administrativa(text, uuid),
  public.quitar_producto_seccion_inicio_administrativa(uuid),
  public.mover_producto_seccion_inicio_administrativa(uuid, text)
  to authenticated;

notify pgrst, 'reload schema';
commit;
