-- Endurece el contrato de la RPC administrativa sin cambiar su firma pública.
-- La operación sigue siendo atómica: producto y presentación principal se guardan
-- dentro de la misma llamada y no se recrean IDs existentes.

create or replace function public.guardar_producto_administrativo(
  p_producto_id uuid,
  p_categoria_id uuid,
  p_nombre text,
  p_slug text,
  p_descripcion text,
  p_ruta_imagen text,
  p_activo boolean,
  p_disponible boolean,
  p_destacado boolean,
  p_mas_vendido boolean,
  p_nuevo boolean,
  p_orden integer,
  p_presentacion_nombre text,
  p_cantidad numeric,
  p_unidad text,
  p_precio_neto bigint,
  p_precio_final bigint,
  p_presentacion_activa boolean
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_producto_id uuid;
  v_presentacion_id uuid;
  v_unidad text := upper(btrim(p_unidad));
  v_principales_activas integer;
begin
  if not public.es_admin() then
    raise exception 'NO_AUTORIZADO' using errcode = '42501';
  end if;

  if p_categoria_id is null or not exists (
    select 1
    from public.categorias
    where id = p_categoria_id
      and activa
  ) then
    raise exception 'CATEGORIA_INVALIDA' using errcode = '22023';
  end if;

  if nullif(btrim(p_nombre), '') is null then
    raise exception 'NOMBRE_REQUERIDO' using errcode = '22023';
  end if;

  if p_slug is null or btrim(p_slug) !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception 'SLUG_INVALIDO' using errcode = '22023';
  end if;

  if nullif(btrim(p_presentacion_nombre), '') is null then
    raise exception 'PRESENTACION_REQUERIDA' using errcode = '22023';
  end if;

  if v_unidad is null or v_unidad not in ('KG', 'GR', 'UND') then
    raise exception 'UNIDAD_INVALIDA' using errcode = '22023';
  end if;

  if p_cantidad is null or p_cantidad <= 0 then
    raise exception 'CANTIDAD_INVALIDA' using errcode = '22023';
  end if;

  if p_precio_neto is null
     or p_precio_final is null
     or p_precio_neto < 0
     or p_precio_final < 0
     or p_precio_final < p_precio_neto then
    raise exception 'PRECIO_INVALIDO' using errcode = '22023';
  end if;

  if p_presentacion_activa is not true then
    raise exception 'PRESENTACION_PRINCIPAL_REQUERIDA' using errcode = '22023';
  end if;

  if p_activo is null
     or p_disponible is null
     or p_destacado is null
     or p_mas_vendido is null
     or p_nuevo is null
     or p_orden is null then
    raise exception 'DATOS_PRODUCTO_INVALIDOS' using errcode = '22023';
  end if;

  if p_producto_id is null then
    insert into public.productos (
      categoria_id,
      nombre,
      slug,
      descripcion,
      ruta_imagen,
      unidad_base,
      activo,
      disponible,
      destacado,
      mas_vendido,
      nuevo,
      orden
    )
    values (
      p_categoria_id,
      btrim(p_nombre),
      btrim(p_slug),
      nullif(btrim(p_descripcion), ''),
      nullif(btrim(p_ruta_imagen), ''),
      'comercial',
      p_activo,
      p_disponible,
      p_destacado,
      p_mas_vendido,
      p_nuevo,
      p_orden
    )
    returning id into v_producto_id;

    insert into public.presentaciones_producto (
      producto_id,
      nombre,
      cantidad,
      unidad,
      precio_neto,
      precio_final,
      es_principal,
      activa,
      orden
    )
    values (
      v_producto_id,
      btrim(p_presentacion_nombre),
      p_cantidad,
      v_unidad,
      p_precio_neto,
      p_precio_final,
      true,
      true,
      p_orden
    );

    return v_producto_id;
  end if;

  select id
  into v_producto_id
  from public.productos
  where id = p_producto_id
  for update;

  if not found then
    raise exception 'PRODUCTO_INEXISTENTE' using errcode = '22023';
  end if;

  select count(*)
  into v_principales_activas
  from public.presentaciones_producto
  where producto_id = v_producto_id
    and es_principal
    and activa;

  if v_principales_activas <> 1 then
    raise exception 'PRESENTACION_PRINCIPAL_REQUERIDA' using errcode = '22023';
  end if;

  select id
  into v_presentacion_id
  from public.presentaciones_producto
  where producto_id = v_producto_id
    and es_principal
    and activa
  for update;

  if not found then
    raise exception 'PRESENTACION_PRINCIPAL_REQUERIDA' using errcode = '22023';
  end if;

  update public.productos
  set categoria_id = p_categoria_id,
      nombre = btrim(p_nombre),
      slug = btrim(p_slug),
      descripcion = nullif(btrim(p_descripcion), ''),
      ruta_imagen = nullif(btrim(p_ruta_imagen), ''),
      activo = p_activo,
      disponible = p_disponible,
      destacado = p_destacado,
      mas_vendido = p_mas_vendido,
      nuevo = p_nuevo,
      orden = p_orden
  where id = v_producto_id;

  update public.presentaciones_producto
  set nombre = btrim(p_presentacion_nombre),
      cantidad = p_cantidad,
      unidad = v_unidad,
      precio_neto = p_precio_neto,
      precio_final = p_precio_final,
      es_principal = true,
      activa = true,
      orden = p_orden
  where id = v_presentacion_id;

  return v_producto_id;
end;
$$;

-- CREATE OR REPLACE conserva el owner de la función existente. Reaplicar el
-- contrato de ejecución evita que privilegios por defecto amplíen su superficie.
revoke all on function public.guardar_producto_administrativo(uuid, uuid, text, text, text, text, boolean, boolean, boolean, boolean, boolean, integer, text, numeric, text, bigint, bigint, boolean) from public, anon;
grant execute on function public.guardar_producto_administrativo(uuid, uuid, text, text, text, text, boolean, boolean, boolean, boolean, boolean, integer, text, numeric, text, bigint, bigint, boolean) to authenticated;
