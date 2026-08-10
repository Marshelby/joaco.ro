create function public.guardar_producto_administrativo(
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
begin
  if not public.es_admin() then
    raise exception 'No autorizado';
  end if;
  if p_nombre is null or btrim(p_nombre) = '' or p_slug is null or p_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception 'Datos de producto inválidos';
  end if;
  if p_cantidad is null or p_cantidad <= 0 or p_unidad is null or btrim(p_unidad) = '' or p_precio_neto < 0 or p_precio_final < 0 then
    raise exception 'Datos de presentación inválidos';
  end if;
  if not exists (select 1 from public.categorias where id = p_categoria_id) then
    raise exception 'Categoría inválida';
  end if;

  if p_producto_id is null then
    insert into public.productos (categoria_id, nombre, slug, descripcion, ruta_imagen, unidad_base, activo, disponible, destacado, mas_vendido, nuevo, orden)
    values (p_categoria_id, btrim(p_nombre), p_slug, nullif(btrim(p_descripcion), ''), nullif(btrim(p_ruta_imagen), ''), 'comercial', p_activo, p_disponible, p_destacado, p_mas_vendido, p_nuevo, p_orden)
    returning id into v_producto_id;
    insert into public.presentaciones_producto (producto_id, nombre, cantidad, unidad, precio_neto, precio_final, es_principal, activa, orden)
    values (v_producto_id, btrim(p_presentacion_nombre), p_cantidad, upper(btrim(p_unidad)), p_precio_neto, p_precio_final, true, p_presentacion_activa, p_orden);
  else
    update public.productos set categoria_id = p_categoria_id, nombre = btrim(p_nombre), slug = p_slug,
      descripcion = nullif(btrim(p_descripcion), ''), ruta_imagen = nullif(btrim(p_ruta_imagen), ''), activo = p_activo,
      disponible = p_disponible, destacado = p_destacado, mas_vendido = p_mas_vendido, nuevo = p_nuevo, orden = p_orden
    where id = p_producto_id returning id into v_producto_id;
    if v_producto_id is null then raise exception 'Producto inexistente'; end if;
    update public.presentaciones_producto set nombre = btrim(p_presentacion_nombre), cantidad = p_cantidad,
      unidad = upper(btrim(p_unidad)), precio_neto = p_precio_neto, precio_final = p_precio_final,
      activa = p_presentacion_activa, orden = p_orden
    where producto_id = v_producto_id and es_principal and activa;
    if not found then
      insert into public.presentaciones_producto (producto_id, nombre, cantidad, unidad, precio_neto, precio_final, es_principal, activa, orden)
      values (v_producto_id, btrim(p_presentacion_nombre), p_cantidad, upper(btrim(p_unidad)), p_precio_neto, p_precio_final, true, p_presentacion_activa, p_orden);
    end if;
  end if;
  return v_producto_id;
end;
$$;

revoke all on function public.guardar_producto_administrativo(uuid, uuid, text, text, text, text, boolean, boolean, boolean, boolean, boolean, integer, text, numeric, text, bigint, bigint, boolean) from public, anon;
grant execute on function public.guardar_producto_administrativo(uuid, uuid, text, text, text, text, boolean, boolean, boolean, boolean, boolean, integer, text, numeric, text, bigint, bigint, boolean) to authenticated;
