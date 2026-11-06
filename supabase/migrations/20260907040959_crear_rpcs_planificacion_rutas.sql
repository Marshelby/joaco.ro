-- Rutas P1: RPCs administrativas de creación, sincronización y reordenamiento.

create function public.obtener_o_crear_ruta_administrativa(
  p_fecha_operativa date
)
returns public.rutas
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ruta public.rutas%rowtype;
  v_origen public.configuracion_logistica%rowtype;
begin
  if auth.uid() is null or not coalesce(public.es_admin(), false) then
    raise exception 'NO_AUTORIZADO';
  end if;
  if p_fecha_operativa is null then
    raise exception 'FECHA_OPERATIVA_REQUERIDA';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('ruta-principal:' || p_fecha_operativa::text, 0));

  select * into v_ruta
  from public.rutas r
  where r.fecha_operativa = p_fecha_operativa
    and r.es_principal
  for update;
  if found then
    return v_ruta;
  end if;

  select * into v_origen
  from public.configuracion_logistica c
  where c.activa and c.es_principal
  for share;

  insert into public.rutas (
    fecha_operativa, es_principal, estado_logistico,
    origen_nombre_snapshot, origen_direccion_snapshot,
    origen_latitud_snapshot, origen_longitud_snapshot,
    creada_por
  ) values (
    p_fecha_operativa, true, 'borrador',
    v_origen.nombre_origen, v_origen.direccion_origen,
    v_origen.latitud, v_origen.longitud,
    auth.uid()
  ) returning * into v_ruta;

  return v_ruta;
exception
  when unique_violation then
    select * into v_ruta
    from public.rutas r
    where r.fecha_operativa = p_fecha_operativa
      and r.es_principal
    for update;
    if found then return v_ruta; end if;
    raise;
end;
$$;

create function public.sincronizar_paradas_ruta_administrativa(
  p_ruta_id uuid
)
returns table (
  ruta_id uuid,
  paradas_insertadas integer,
  paradas_actualizadas integer,
  version bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ruta public.rutas%rowtype;
  v_insertadas integer := 0;
  v_actualizadas integer := 0;
begin
  if auth.uid() is null or not coalesce(public.es_admin(), false) then
    raise exception 'NO_AUTORIZADO';
  end if;
  if p_ruta_id is null then
    raise exception 'RUTA_REQUERIDA';
  end if;

  select * into v_ruta
  from public.rutas r
  where r.id = p_ruta_id
  for update;
  if not found then raise exception 'RUTA_NO_ENCONTRADA'; end if;
  if v_ruta.estado_logistico in ('completada', 'archivada') then
    raise exception 'RUTA_NO_SINCRONIZABLE';
  end if;

  update public.paradas_ruta pr
  set estado_logistico = case
        when p.estado = 'cancelado' then 'cancelada'::public.estado_parada_ruta
        else 'omitida'::public.estado_parada_ruta
      end,
      posicion = null
  from public.pedidos p
  where pr.ruta_id = v_ruta.id
    and p.id = pr.pedido_id
    and pr.estado_logistico not in ('entregada', 'cancelada')
    and (p.estado = 'cancelado' or p.fecha_entrega is distinct from v_ruta.fecha_operativa);
  get diagnostics v_actualizadas = row_count;

  insert into public.paradas_ruta (
    ruta_id, pedido_id, posicion, estado_logistico,
    numero_pedido_snapshot, cliente_id, cliente_nombre_snapshot,
    destinatario_snapshot, telefono_snapshot,
    direccion_snapshot, comuna_snapshot, region_snapshot, referencia_snapshot,
    zona_snapshot, latitud_snapshot, longitud_snapshot,
    total_snapshot, metodos_pago_previstos_snapshot
  )
  select
    v_ruta.id, p.id, null, 'sin_ordenar',
    p.numero_pedido, p.cliente_id, p.nombre_cliente_snapshot,
    coalesce(p.destinatario_entrega_snapshot, d.destinatario, d.nombre),
    coalesce(p.telefono_contacto_entrega_snapshot, p.telefono_cliente_snapshot, d.telefono_contacto),
    coalesce(p.direccion_snapshot, d.direccion), coalesce(p.comuna_snapshot, d.comuna),
    coalesce(p.region_snapshot, d.region), coalesce(p.referencia_direccion_snapshot, d.referencia),
    coalesce(p.zona_entrega_snapshot, z.nombre),
    coalesce(p.latitud_entrega_snapshot, d.latitud), coalesce(p.longitud_entrega_snapshot, d.longitud),
    coalesce(p.total_final, p.total), p.metodos_pago_previstos
  from public.pedidos p
  left join public.direcciones_cliente d
    on d.id = p.direccion_cliente_id and d.cliente_id is not distinct from p.cliente_id
  left join public.zonas_entrega z on z.id = d.zona_entrega_id
  where p.fecha_entrega = v_ruta.fecha_operativa
    and p.estado in ('confirmado', 'preparando', 'listo_despacho', 'en_reparto')
    and not exists (
      select 1 from public.paradas_ruta pr
      where pr.ruta_id = v_ruta.id and pr.pedido_id = p.id
    )
  on conflict (ruta_id, pedido_id) do nothing;
  get diagnostics v_insertadas = row_count;

  if v_insertadas > 0 or v_actualizadas > 0 then
    update public.rutas
    set version = version + 1
    where id = v_ruta.id
    returning * into v_ruta;
  end if;

  return query select v_ruta.id, v_insertadas, v_actualizadas, v_ruta.version;
end;
$$;

create function public.guardar_orden_ruta_administrativo(
  p_ruta_id uuid,
  p_orden uuid[],
  p_version_esperada bigint
)
returns table (
  ruta_id uuid,
  version bigint
)
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
  if auth.uid() is null or not coalesce(public.es_admin(), false) then
    raise exception 'NO_AUTORIZADO';
  end if;
  if p_ruta_id is null then raise exception 'RUTA_REQUERIDA'; end if;
  if p_version_esperada is null then raise exception 'VERSION_REQUERIDA'; end if;

  select * into v_ruta
  from public.rutas r
  where r.id = p_ruta_id
  for update;
  if not found then raise exception 'RUTA_NO_ENCONTRADA'; end if;
  if v_ruta.version <> p_version_esperada then raise exception 'RUTA_DESACTUALIZADA'; end if;
  if v_ruta.estado_logistico in ('en_reparto', 'completada', 'archivada') then
    raise exception 'RUTA_NO_REORDENABLE';
  end if;

  select count(*), count(distinct parada_id)
  into v_cantidad_enteros, v_cantidad_distintos
  from unnest(v_orden) as entrada(parada_id);
  if v_cantidad_enteros <> v_cantidad_distintos then raise exception 'ORDEN_CON_PARADAS_DUPLICADAS'; end if;

  select count(*) into v_cantidad_existentes
  from public.paradas_ruta pr
  where pr.ruta_id = v_ruta.id and pr.id = any(v_orden);
  if v_cantidad_existentes <> cardinality(v_orden) then raise exception 'PARADA_NO_CORRESPONDE_A_RUTA'; end if;

  select count(*) into v_cantidad_planificables
  from public.paradas_ruta pr
  where pr.ruta_id = v_ruta.id
    and pr.id = any(v_orden)
    and pr.estado_logistico in ('sin_ordenar', 'planificada');
  if v_cantidad_planificables <> cardinality(v_orden) then raise exception 'PARADA_NO_PLANIFICABLE'; end if;

  update public.paradas_ruta
  set posicion = null,
      estado_logistico = 'sin_ordenar'
  where ruta_id = v_ruta.id
    and estado_logistico in ('sin_ordenar', 'planificada');

  update public.paradas_ruta pr
  set posicion = orden.posicion::integer,
      estado_logistico = 'planificada'
  from unnest(v_orden) with ordinality as orden(parada_id, posicion)
  where pr.ruta_id = v_ruta.id
    and pr.id = orden.parada_id;

  update public.rutas
  set estado_logistico = case
        when cardinality(v_orden) > 0 and estado_logistico = 'borrador' then 'planificada'::public.estado_ruta_logistica
        when cardinality(v_orden) = 0 and estado_logistico = 'planificada' then 'borrador'::public.estado_ruta_logistica
        else estado_logistico
      end,
      version = version + 1
  where id = v_ruta.id
  returning * into v_ruta;

  return query select v_ruta.id, v_ruta.version;
end;
$$;

alter function public.obtener_o_crear_ruta_administrativa(date) owner to postgres;
alter function public.sincronizar_paradas_ruta_administrativa(uuid) owner to postgres;
alter function public.guardar_orden_ruta_administrativo(uuid, uuid[], bigint) owner to postgres;

revoke all on function public.obtener_o_crear_ruta_administrativa(date) from public, anon, authenticated;
revoke all on function public.sincronizar_paradas_ruta_administrativa(uuid) from public, anon, authenticated;
revoke all on function public.guardar_orden_ruta_administrativo(uuid, uuid[], bigint) from public, anon, authenticated;

grant execute on function public.obtener_o_crear_ruta_administrativa(date) to authenticated;
grant execute on function public.sincronizar_paradas_ruta_administrativa(uuid) to authenticated;
grant execute on function public.guardar_orden_ruta_administrativo(uuid, uuid[], bigint) to authenticated;