-- Aplicar manualmente. Orden visual de todos los pedidos de la jornada.
-- Reutiliza rutas/paradas y la creación administrativa; no modifica estados.
create function public.orden_ruta_dia(
  p_fecha date, p_orden uuid[] default null, p_version bigint default null
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_ruta public.rutas%rowtype;
  v_actuales uuid[];
  v_guardados uuid[];
begin
  if auth.uid() is null or not coalesce(public.es_admin(), false) then
    raise exception 'NO_AUTORIZADO';
  end if;
  if p_fecha is null then raise exception 'FECHA_REQUERIDA'; end if;
  perform pg_advisory_xact_lock(hashtextextended('ruta-principal:' || p_fecha::text, 0));
  select * into v_ruta from public.rutas r
    where r.fecha_operativa = p_fecha and r.es_principal for update;

  if p_orden is not null then
    if coalesce(v_ruta.version, 0) is distinct from p_version then
      raise exception 'RUTA_DESACTUALIZADA';
    end if;
    -- Bloquea los pedidos existentes mientras se comprueba la jornada.
    perform p.id from public.pedidos p where p.fecha_entrega = p_fecha for share;
    select coalesce(array_agg(p.id order by p.id), array[]::uuid[]) into v_actuales
      from public.pedidos p where p.fecha_entrega = p_fecha and p.estado <> 'cancelado';
    if cardinality(p_orden) <> cardinality(v_actuales)
      or exists (select 1 from unnest(p_orden) id where id is null)
      or (select count(distinct id) from unnest(p_orden) id) <> cardinality(p_orden)
      or not (p_orden @> v_actuales and p_orden <@ v_actuales) then
      raise exception 'PEDIDOS_DESACTUALIZADOS';
    end if;
    if v_ruta.id is null then
      select * into v_ruta from public.obtener_o_crear_ruta_administrativa(p_fecha);
    end if;
    -- Libera posiciones antes de asignarlas para respetar el índice único.
    update public.paradas_ruta set posicion = null where ruta_id = v_ruta.id;
    insert into public.paradas_ruta (
      ruta_id, pedido_id, numero_pedido_snapshot, cliente_nombre_snapshot, total_snapshot
    ) select v_ruta.id, p.id, p.numero_pedido, p.nombre_cliente_snapshot, coalesce(p.total_final, p.total)
      from public.pedidos p where p.id = any(p_orden)
      on conflict (ruta_id, pedido_id) do nothing;
    update public.paradas_ruta pr set posicion = o.posicion::integer
      from unnest(p_orden) with ordinality o(pedido_id, posicion)
      where pr.ruta_id = v_ruta.id and pr.pedido_id = o.pedido_id;
    update public.rutas r set version = r.version + 1 where r.id = v_ruta.id
      returning r.* into v_ruta;
  end if;
  select coalesce(array_agg(pr.pedido_id order by pr.posicion), array[]::uuid[]) into v_guardados
    from public.paradas_ruta pr where pr.ruta_id = v_ruta.id and pr.posicion is not null;
  return jsonb_build_object('version', coalesce(v_ruta.version, 0), 'orden', v_guardados);
end;
$$;
alter function public.orden_ruta_dia(date, uuid[], bigint) owner to postgres;
revoke all on function public.orden_ruta_dia(date, uuid[], bigint) from public, anon, authenticated;
grant execute on function public.orden_ruta_dia(date, uuid[], bigint) to authenticated;
