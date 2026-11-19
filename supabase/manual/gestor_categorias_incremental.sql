-- Revisar y ejecutar manualmente. Mantiene la FK nullable ON DELETE RESTRICT.
-- Todas las operaciones son atómicas y respetan las políticas RLS existentes.
begin;

create or replace function public.gestionar_categoria_administrativa(
  p_operacion text,
  p_categoria_id uuid,
  p_version timestamptz,
  p_datos jsonb,
  p_productos jsonb
)
returns void
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  v_categoria_id uuid := p_categoria_id;
  v_version timestamptz;
  v_productos_esperados uuid[];
  v_actualizados bigint;
begin
  if auth.uid() is null or not coalesce(public.es_admin(), false) then
    raise exception 'NO_AUTORIZADO' using errcode = '42501';
  end if;

  if p_operacion is null or p_operacion not in ('guardar', 'asignar', 'eliminar')
    or (p_categoria_id is null and p_operacion <> 'guardar')
    or jsonb_typeof(p_productos) is distinct from 'array'
    or (p_operacion = 'guardar' and jsonb_typeof(p_datos) is distinct from 'object') then
    raise exception 'OPERACION_INVALIDA' using errcode = '22023';
  end if;

  select coalesce(array_agg(cambio.id order by cambio.id), '{}'::uuid[])
    into v_productos_esperados
    from jsonb_to_recordset(p_productos) as cambio(id uuid);
  if array_position(v_productos_esperados, null) is not null then
    raise exception 'PRODUCTO_INVALIDO' using errcode = '22023';
  end if;

  if p_operacion <> 'eliminar' and exists (
    select 1 from jsonb_array_elements(p_productos) as cambio(datos)
      where not (cambio.datos ? 'origen')
  ) then
    raise exception 'ORIGEN_PRODUCTO_REQUERIDO' using errcode = '22023';
  end if;

  -- Un pedido de varias líneas puede retener una categoría mientras bloquea
  -- otro producto. El gestor aborta si encuentra un bloqueo incompatible.
  perform p.id from public.productos p
    where p.id = any(v_productos_esperados) order by p.id for no key update nowait;

  if p_categoria_id is not null then
    if p_operacion = 'eliminar' then
      -- Impide nuevas referencias a la categoría hasta que termine la eliminación.
      select c.fecha_actualizacion into v_version
        from public.categorias c where c.id = p_categoria_id for update nowait;
    else
      select c.fecha_actualizacion into v_version
        from public.categorias c where c.id = p_categoria_id for no key update nowait;
    end if;
    if not found or v_version is distinct from p_version then
      raise exception 'CATEGORIA_DESACTUALIZADA' using errcode = '40001';
    end if;
  end if;

  if p_operacion = 'eliminar' then
    update public.productos p set categoria_id = null
      where p.categoria_id = p_categoria_id and p.id = any(v_productos_esperados);

    get diagnostics v_actualizados = row_count;
    if v_actualizados <> cardinality(v_productos_esperados) then
      raise exception 'PRODUCTOS_DESACTUALIZADOS' using errcode = '40001';
    end if;

    -- RESTRICT cancela toda la operación si apareció un producto no confirmado.
    delete from public.categorias where id = p_categoria_id;
    return;
  end if;

  if p_operacion = 'guardar' then
    if p_categoria_id is null then
      insert into public.categorias (nombre, slug, descripcion, orden, activa)
        values (
          btrim(p_datos ->> 'nombre'), p_datos ->> 'slug',
          nullif(btrim(p_datos ->> 'descripcion'), ''),
          (p_datos ->> 'orden')::integer, (p_datos ->> 'activa')::boolean
        )
        returning id into v_categoria_id;
    else
      -- El slug identifica filtros e imágenes del catálogo y se conserva al renombrar.
      update public.categorias
        set nombre = btrim(p_datos ->> 'nombre'),
            descripcion = nullif(btrim(p_datos ->> 'descripcion'), ''),
            orden = (p_datos ->> 'orden')::integer,
            activa = (p_datos ->> 'activa')::boolean
        where id = p_categoria_id;
    end if;
  end if;

  -- Revalida el origen confirmado, incluido NULL, después de bloquear los productos.
  update public.productos p
    set categoria_id = case when cambio.quitar is true then null else v_categoria_id end
    from jsonb_to_recordset(p_productos) as cambio(id uuid, origen uuid, quitar boolean)
    where p.id = cambio.id
      and p.categoria_id is not distinct from cambio.origen
      and (
        (p_operacion = 'guardar' and cambio.quitar is true and p.categoria_id = v_categoria_id)
        or (cambio.quitar is not true and (p_operacion = 'guardar' or p.categoria_id is null))
      );

  get diagnostics v_actualizados = row_count;
  if v_actualizados <> cardinality(v_productos_esperados) then
    raise exception 'PRODUCTOS_DESACTUALIZADOS' using errcode = '40001';
  end if;
exception
  when lock_not_available then
    raise exception 'CATALOGO_EN_USO' using errcode = '40001';
end;
$$;

revoke all on function public.gestionar_categoria_administrativa(text, uuid, timestamptz, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.gestionar_categoria_administrativa(text, uuid, timestamptz, jsonb, jsonb)
  to authenticated;

-- El checkout web valida la presentación y el producto, pero no su categoría.
-- La comprobación corre solo al insertar nuevas líneas web y usa el error que
-- el checkout ya traduce. Los reintentos idempotentes no insertan líneas.
create or replace function public.validar_categoria_item_pedido_web()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  v_categoria_id uuid;
begin
  if exists (
    select 1 from public.pedidos p
      where p.id = new.pedido_id and p.canal_origen = 'web'
  ) then
    select p.categoria_id into v_categoria_id
      from public.productos p where p.id = new.producto_id for share;

    perform c.id from public.categorias c
      where c.id = v_categoria_id and c.activa for share;

    if not found then
      raise exception 'PRESENTACION_NO_DISPONIBLE';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.validar_categoria_item_pedido_web() from public, anon, authenticated;

drop trigger if exists validar_categoria_item_pedido_web_antes_de_insertar on public.items_pedido;
create trigger validar_categoria_item_pedido_web_antes_de_insertar
before insert on public.items_pedido
for each row execute function public.validar_categoria_item_pedido_web();

notify pgrst, 'reload schema';
commit;
