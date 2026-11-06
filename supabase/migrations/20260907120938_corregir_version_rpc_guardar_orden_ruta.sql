-- Corrige la ambigüedad entre el campo de salida version y rutas.version.

create or replace function public.guardar_orden_ruta_administrativo(
  p_ruta_id uuid,
  p_orden uuid[],
  p_version_esperada bigint
)
returns table (ruta_id uuid, version bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ruta public.rutas%rowtype;
  v_orden uuid[] := coalesce(p_orden, array[]::uuid[]);
  v_cantidad_enteros integer;
  v_cantidad_distintos integer;
  v_cantidad_existentes integer;
  v_cantidad_planificables integer;
begin
  if auth.uid() is null or not coalesce(public.es_admin(), false) then raise exception 'NO_AUTORIZADO'; end if;
  if p_ruta_id is null then raise exception 'RUTA_REQUERIDA'; end if;
  if p_version_esperada is null then raise exception 'VERSION_REQUERIDA'; end if;

  select * into v_ruta from public.rutas r where r.id = p_ruta_id for update;
  if not found then raise exception 'RUTA_NO_ENCONTRADA'; end if;
  if v_ruta.version <> p_version_esperada then raise exception 'RUTA_DESACTUALIZADA'; end if;
  if v_ruta.estado_logistico in ('en_reparto', 'completada', 'archivada') then raise exception 'RUTA_NO_REORDENABLE'; end if;

  select count(*), count(distinct parada_id) into v_cantidad_enteros, v_cantidad_distintos
  from unnest(v_orden) as entrada(parada_id);
  if v_cantidad_enteros <> v_cantidad_distintos then raise exception 'ORDEN_CON_PARADAS_DUPLICADAS'; end if;

  select count(*) into v_cantidad_existentes from public.paradas_ruta pr
  where pr.ruta_id = v_ruta.id and pr.id = any(v_orden);
  if v_cantidad_existentes <> cardinality(v_orden) then raise exception 'PARADA_NO_CORRESPONDE_A_RUTA'; end if;

  select count(*) into v_cantidad_planificables from public.paradas_ruta pr
  where pr.ruta_id = v_ruta.id and pr.id = any(v_orden)
    and pr.estado_logistico in ('sin_ordenar', 'planificada');
  if v_cantidad_planificables <> cardinality(v_orden) then raise exception 'PARADA_NO_PLANIFICABLE'; end if;

  update public.paradas_ruta pr set posicion = null, estado_logistico = 'sin_ordenar'
  where pr.ruta_id = v_ruta.id and pr.estado_logistico in ('sin_ordenar', 'planificada');

  update public.paradas_ruta pr
  set posicion = orden.posicion::integer, estado_logistico = 'planificada'
  from unnest(v_orden) with ordinality as orden(parada_id, posicion)
  where pr.ruta_id = v_ruta.id and pr.id = orden.parada_id;

  update public.rutas r
  set estado_logistico = case
        when cardinality(v_orden) > 0 and r.estado_logistico = 'borrador' then 'planificada'::public.estado_ruta_logistica
        when cardinality(v_orden) = 0 and r.estado_logistico = 'planificada' then 'borrador'::public.estado_ruta_logistica
        else r.estado_logistico
      end,
      version = r.version + 1
  where r.id = v_ruta.id
  returning r.* into v_ruta;

  return query select v_ruta.id, v_ruta.version;
end;
$$;

alter function public.guardar_orden_ruta_administrativo(uuid, uuid[], bigint) owner to postgres;
revoke all on function public.guardar_orden_ruta_administrativo(uuid, uuid[], bigint) from public, anon, authenticated;
grant execute on function public.guardar_orden_ruta_administrativo(uuid, uuid[], bigint) to authenticated;