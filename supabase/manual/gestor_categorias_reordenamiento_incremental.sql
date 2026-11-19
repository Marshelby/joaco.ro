-- Revisar y ejecutar manualmente. Actualiza exclusivamente el orden de categorías.
begin;

create or replace function public.reordenar_categorias_administrativas(
  p_categorias jsonb,
  p_categoria_id uuid,
  p_direccion integer
)
returns void
language plpgsql
security invoker
set search_path = pg_catalog
set lock_timeout = '250ms'
as $$
declare
  v_posicion integer;
  v_vecina integer;
  v_total bigint;
  v_ids uuid[];
  v_ordenes integer[];
  v_normalizar boolean;
begin
  if auth.uid() is null or not coalesce(public.es_admin(), false) then
    raise exception 'NO_AUTORIZADO' using errcode = '42501';
  end if;

  if jsonb_typeof(p_categorias) is distinct from 'array'
    or p_categoria_id is null or p_direccion is null or p_direccion not in (-1, 1) then
    raise exception 'OPERACION_INVALIDA' using errcode = '22023';
  end if;

  if current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'AISLAMIENTO_INCOMPATIBLE' using errcode = '40001';
  end if;

  -- Protege la lista completa de altas, ediciones, bajas y otros reordenamientos.
  -- Las lecturas y los bloqueos de fila siguen siendo compatibles a nivel de tabla.
  lock table public.categorias in share row exclusive mode nowait;

  select count(*) into v_total from public.categorias;

  with instantanea as (
    select (e.datos ->> 'id')::uuid as id,
           (e.datos ->> 'version')::timestamptz as version,
           e.posicion
    from jsonb_array_elements(p_categorias) with ordinality as e(datos, posicion)
  )
  select array_agg(c.id order by i.posicion),
         array_agg(c.orden order by i.posicion)
    into v_ids, v_ordenes
    from instantanea i
    join public.categorias c on c.id = i.id and c.fecha_actualizacion = i.version
    having count(distinct c.id) = v_total;

  if not found or jsonb_array_length(p_categorias) <> v_total
    or cardinality(v_ids) is distinct from jsonb_array_length(p_categorias)
    or v_ids is distinct from (
      select array_agg(c.id order by c.orden, convert_to(c.nombre, 'UTF8'), c.id)
      from public.categorias c
    ) then
    raise exception 'CATEGORIAS_DESACTUALIZADAS' using errcode = '40001';
  end if;

  v_posicion := array_position(v_ids, p_categoria_id);
  v_vecina := v_posicion + p_direccion;
  if v_posicion is null or v_vecina < 1 or v_vecina > v_total then
    raise exception 'POSICION_INVALIDA' using errcode = '22023';
  end if;

  -- Conserva los valores y huecos si ninguna de las dos posiciones está empatada.
  -- Si hay un empate en el par, materializa el orden final como posiciones únicas.
  v_normalizar := cardinality(array_positions(v_ordenes, v_ordenes[v_posicion])) > 1
    or cardinality(array_positions(v_ordenes, v_ordenes[v_vecina])) > 1;

  update public.categorias c
    set orden = destino.orden
    from (
      select id, case when v_normalizar then posicion_final::integer
                 else v_ordenes[posicion_final::integer] end as orden
      from (
        select entrada.id, case entrada.posicion
          when v_posicion then v_vecina
          when v_vecina then v_posicion
          else entrada.posicion
        end as posicion_final
        from unnest(v_ids) with ordinality as entrada(id, posicion)
      ) posiciones
    ) destino
    where c.id = destino.id and c.orden is distinct from destino.orden;
exception
  when lock_not_available then
    raise exception 'CATEGORIAS_EN_USO' using errcode = '40001';
end;
$$;

revoke all on function public.reordenar_categorias_administrativas(jsonb, uuid, integer)
  from public, anon, authenticated;
grant execute on function public.reordenar_categorias_administrativas(jsonb, uuid, integer)
  to authenticated;

notify pgrst, 'reload schema';
commit;
