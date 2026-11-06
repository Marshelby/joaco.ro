-- Bloque 1, microintegración 4/8: permiso temporal de preparación.
-- Requiere 20261106010000 y 20261106030000. No activa auditoría ni régimen nuevo.
begin;

-- Auditoría local: la aplicación sólo lee estas tablas; todas sus mutaciones
-- oficiales usan RPC SECURITY DEFINER de postgres. Los grants históricos de
-- DML permitían saltarse las RPC, cambiar fecha_entrega o alterar la solicitud
-- para eludir faltantes. Se cierra DML directo sin tocar SELECT, RLS ni RPC.
-- Incluye service_role: BYPASSRLS no debe equivaler a permiso de escritura.
-- Sin grants por columna en las migraciones locales vigentes.
revoke insert, update, delete, truncate on table
  public.pedidos, public.items_pedido, public.preparacion_items_pedido
  from public, anon, authenticated, service_role;

-- Cuerpos vigentes conservados; validación tras locks y antes de retornos
-- idempotentes. clock_timestamp evita usar el inicio de transacción si la
-- espera de locks cruza medianoche. NULL y fechas infinitas tampoco coinciden.
-- No se consulta fecha_entrega_disponible ni los cortes comerciales.
create or replace function public.marcar_pedido_preparando_administrativo(
  p_pedido_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pedido public.pedidos%rowtype;
begin
  if not coalesce(public.es_admin(), false) then raise exception 'NO_AUTORIZADO'; end if;

  select * into v_pedido from public.pedidos p where p.id = p_pedido_id for update;
  if not found then raise exception 'PEDIDO_NO_ENCONTRADO'; end if;
  if v_pedido.fecha_entrega is distinct from (clock_timestamp() at time zone 'America/Santiago')::date then
    raise exception 'PREPARACION_FECHA_NO_HABILITADA';
  end if;
  if v_pedido.estado = 'preparando' then return v_pedido.id; end if;
  if v_pedido.estado <> 'confirmado' then raise exception 'ESTADO_PEDIDO_INVALIDO'; end if;

  update public.pedidos
  set estado = 'preparando',
      preparacion_estado = coalesce(preparacion_estado, 'pendiente')
  where id = v_pedido.id;
  return v_pedido.id;
end;
$$;

create or replace function public.marcar_pedido_listo_despacho_administrativo(
  p_pedido_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pedido public.pedidos%rowtype;
begin
  if not coalesce(public.es_admin(), false) then raise exception 'NO_AUTORIZADO'; end if;

  select * into v_pedido from public.pedidos p where p.id = p_pedido_id for update;
  if not found then raise exception 'PEDIDO_NO_ENCONTRADO'; end if;
  if v_pedido.fecha_entrega is distinct from (clock_timestamp() at time zone 'America/Santiago')::date then
    raise exception 'PREPARACION_FECHA_NO_HABILITADA';
  end if;
  if v_pedido.estado = 'listo_despacho' then return v_pedido.id; end if;
  if v_pedido.estado <> 'preparando' then raise exception 'ESTADO_PEDIDO_INVALIDO'; end if;
  if v_pedido.preparacion_estado = 'pendiente' then raise exception 'PREPARACION_PENDIENTE_DE_FINALIZACION'; end if;

  update public.pedidos set estado = 'listo_despacho' where id = v_pedido.id;
  return v_pedido.id;
end;
$$;

create or replace function public.guardar_preparacion_item_pedido_administrativo(
  p_item_pedido_id uuid,
  p_cantidad_preparada numeric,
  p_motivo text default null
)
returns table (
  pedido_id uuid,
  item_pedido_id uuid,
  cantidad_preparada numeric,
  tiene_faltante boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pedido_id uuid;
  v_pedido public.pedidos%rowtype;
  v_item public.items_pedido%rowtype;
  v_modo text;
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
begin
  if not coalesce(public.es_admin(), false) then raise exception 'NO_AUTORIZADO'; end if;
  if p_item_pedido_id is null then raise exception 'ITEM_PEDIDO_NO_ENCONTRADO'; end if;
  if p_cantidad_preparada is null then raise exception 'CANTIDAD_PREPARADA_REQUERIDA'; end if;
  if p_cantidad_preparada < 0 then raise exception 'CANTIDAD_PREPARADA_INVALIDA'; end if;
  if v_motivo is not null and char_length(v_motivo) > 400 then raise exception 'MOTIVO_DEMASIADO_LARGO'; end if;

  select i.pedido_id into v_pedido_id from public.items_pedido i where i.id = p_item_pedido_id;
  if not found then raise exception 'ITEM_PEDIDO_NO_ENCONTRADO'; end if;

  select * into v_pedido from public.pedidos p where p.id = v_pedido_id for update;
  if not found then raise exception 'PEDIDO_NO_ENCONTRADO'; end if;

  select * into v_item from public.items_pedido i where i.id = p_item_pedido_id for update;
  if not found or v_item.pedido_id is distinct from v_pedido.id then raise exception 'ITEM_PEDIDO_NO_CORRESPONDE_AL_PEDIDO'; end if;
  perform 1 from public.preparacion_items_pedido pi where pi.item_pedido_id = v_item.id for update;
  if v_pedido.fecha_entrega is distinct from (clock_timestamp() at time zone 'America/Santiago')::date then
    raise exception 'PREPARACION_FECHA_NO_HABILITADA';
  end if;
  if v_pedido.estado <> 'preparando' then raise exception 'ESTADO_PEDIDO_INVALIDO'; end if;
  if p_cantidad_preparada > v_item.cantidad then raise exception 'CANTIDAD_PREPARADA_SUPERA_SOLICITADA'; end if;

  v_modo := coalesce(
    v_item.modo_cantidad_snapshot,
    case
      when upper(btrim(v_item.unidad_snapshot)) = 'KG' and lower(coalesce(v_item.nombre_presentacion_snapshot, '')) !~ '(saco|malla|caja|paquete|docena)' then 'kg_fraccionable'
      when lower(coalesce(v_item.nombre_presentacion_snapshot, '')) ~ '(saco|malla|caja|paquete|docena)' then 'presentacion_cerrada'
      else 'unidad'
    end
  );
  if v_modo in ('presentacion_cerrada', 'unidad') and p_cantidad_preparada <> trunc(p_cantidad_preparada) then raise exception 'CANTIDAD_PREPARADA_DEBE_SER_ENTERA'; end if;

  update public.pedidos set preparacion_estado = 'pendiente' where id = v_pedido.id and preparacion_estado is null;

  if p_cantidad_preparada = v_item.cantidad then
    delete from public.preparacion_items_pedido where preparacion_items_pedido.item_pedido_id = v_item.id;
    return query select v_pedido.id, v_item.id, v_item.cantidad, false;
    return;
  end if;

  insert into public.preparacion_items_pedido (pedido_id, item_pedido_id, cantidad_preparada, motivo_faltante, registrado_por)
  values (v_pedido.id, v_item.id, p_cantidad_preparada, v_motivo, auth.uid())
  on conflict on constraint preparacion_items_pedido_item_pedido_id_key do update
  set cantidad_preparada = excluded.cantidad_preparada,
      motivo_faltante = excluded.motivo_faltante,
      registrado_por = auth.uid();

  return query select v_pedido.id, v_item.id, p_cantidad_preparada, true;
end;
$$;

create or replace function public.finalizar_preparacion_pedido_administrativo(p_pedido_id uuid)
returns table (
  pedido_id uuid,
  estado public.estado_pedido,
  preparacion_estado text,
  subtotal_final bigint,
  total_final bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pedido public.pedidos%rowtype;
  v_item public.items_pedido%rowtype;
  v_preparada numeric;
  v_modo text;
  v_subtotal bigint := 0;
  v_total bigint;
  v_completa boolean := true;
  v_aplicado bigint := 0;
  v_exceso bigint := 0;
  v_aplicacion public.aplicaciones_pago%rowtype;
  v_conservar bigint;
  v_lineas_faltantes integer := 0;
  v_observacion text;
begin
  if not coalesce(public.es_admin(), false) then raise exception 'NO_AUTORIZADO'; end if;
  select * into v_pedido from public.pedidos p where p.id = p_pedido_id for update;
  if not found then raise exception 'PEDIDO_NO_ENCONTRADO'; end if;

  if v_pedido.fecha_entrega is distinct from (clock_timestamp() at time zone 'America/Santiago')::date then
    raise exception 'PREPARACION_FECHA_NO_HABILITADA';
  end if;

  if v_pedido.estado = 'listo_despacho'
    and v_pedido.preparacion_estado in ('completa', 'incompleta')
    and v_pedido.preparacion_finalizada_en is not null
    and v_pedido.subtotal_final is not null
    and v_pedido.total_final is not null then
    return query select v_pedido.id, v_pedido.estado, v_pedido.preparacion_estado, v_pedido.subtotal_final, v_pedido.total_final;
    return;
  end if;
  if v_pedido.estado <> 'preparando' then raise exception 'ESTADO_PEDIDO_INVALIDO'; end if;

  perform 1 from public.items_pedido i where i.pedido_id = v_pedido.id order by i.id for update;
  perform 1 from public.preparacion_items_pedido pi where pi.pedido_id = v_pedido.id order by pi.item_pedido_id for update;

  -- Adquirir también locks contables existentes antes de evaluar el día real.
  perform 1 from public.aplicaciones_pago a where a.pedido_id = v_pedido.id and a.activa order by a.fecha_creacion desc, a.id desc for update;
  perform 1 from public.pagos p where p.id in (select a.pago_id from public.aplicaciones_pago a where a.pedido_id = v_pedido.id and a.activa) order by p.id for update;
  if v_pedido.fecha_entrega is distinct from (clock_timestamp() at time zone 'America/Santiago')::date then
    raise exception 'PREPARACION_FECHA_NO_HABILITADA';
  end if;

  for v_item in select * from public.items_pedido i where i.pedido_id = v_pedido.id order by i.id loop
    select pi.cantidad_preparada into v_preparada from public.preparacion_items_pedido pi where pi.item_pedido_id = v_item.id;
    v_preparada := coalesce(v_preparada, v_item.cantidad);
    if v_preparada < 0 or v_preparada > v_item.cantidad then raise exception 'CANTIDAD_PREPARADA_INVALIDA'; end if;
    v_modo := coalesce(v_item.modo_cantidad_snapshot, case
      when upper(btrim(v_item.unidad_snapshot)) = 'KG' and lower(coalesce(v_item.nombre_presentacion_snapshot, '')) !~ '(saco|malla|caja|paquete|docena)' then 'kg_fraccionable'
      when lower(coalesce(v_item.nombre_presentacion_snapshot, '')) ~ '(saco|malla|caja|paquete|docena)' then 'presentacion_cerrada'
      else 'unidad' end);
    if v_modo in ('presentacion_cerrada', 'unidad') and v_preparada <> trunc(v_preparada) then raise exception 'CANTIDAD_PREPARADA_DEBE_SER_ENTERA'; end if;
    if v_item.total_final_administrativo is not null then
      -- No existe política autorizada para prorratear un total arbitrario.
      -- Fallar antes de modificar totales o aplicaciones de pago.
      if v_preparada <> v_item.cantidad then
        raise exception 'TOTAL_ADMINISTRATIVO_REQUIERE_PREPARACION_COMPLETA';
      end if;
      v_subtotal := v_subtotal + v_item.total_linea;
    else
      v_subtotal := v_subtotal + round(v_preparada * v_item.precio_final_unitario_snapshot)::bigint;
    end if;
    if v_preparada < v_item.cantidad then v_completa := false; v_lineas_faltantes := v_lineas_faltantes + 1; end if;
  end loop;

  v_total := v_subtotal + v_pedido.costo_entrega - v_pedido.descuento;
  if v_total < 0 then raise exception 'TOTAL_FINAL_INVALIDO'; end if;
  if v_completa and (v_subtotal <> v_pedido.subtotal or v_total <> v_pedido.total) then raise exception 'PREPARACION_COMPLETA_INCONSISTENTE'; end if;

  -- El nuevo límite debe estar visible para el trigger al recrear aplicaciones activas.
  update public.pedidos set subtotal_final = v_subtotal, total_final = v_total where id = v_pedido.id;

  select coalesce(sum(a.monto_aplicado), 0)::bigint into v_aplicado from public.aplicaciones_pago a where a.pedido_id = v_pedido.id and a.activa;
  v_exceso := greatest(v_aplicado - v_total, 0);

  for v_aplicacion in select * from public.aplicaciones_pago a where a.pedido_id = v_pedido.id and a.activa order by a.fecha_creacion desc, a.id desc loop
    exit when v_exceso = 0;
    v_conservar := greatest(v_aplicacion.monto_aplicado - v_exceso, 0);
    update public.aplicaciones_pago set activa = false, fecha_anulacion = now(), anulada_por = auth.uid(), motivo_anulacion = 'Reajuste por preparación incompleta' where id = v_aplicacion.id;
    if v_conservar > 0 then
      insert into public.aplicaciones_pago (pago_id, pedido_id, monto_aplicado) values (v_aplicacion.pago_id, v_pedido.id, v_conservar);
    end if;
    v_exceso := greatest(v_exceso - v_aplicacion.monto_aplicado, 0);
  end loop;

  select coalesce(sum(a.monto_aplicado), 0)::bigint into v_aplicado from public.aplicaciones_pago a where a.pedido_id = v_pedido.id and a.activa;
  if v_aplicado > v_total then raise exception 'APLICACIONES_SUPERAN_TOTAL_FINAL'; end if;

  update public.pedidos
  set preparacion_estado = case when v_completa then 'completa' else 'incompleta' end,
      preparacion_finalizada_en = now(), preparacion_finalizada_por = auth.uid(), estado = 'listo_despacho'
  where id = v_pedido.id;
  v_observacion := case when v_completa then 'Preparación finalizada completa' else format('Preparación finalizada incompleta: %s líneas con faltantes', v_lineas_faltantes) end;
  update public.historial_estados_pedido set observacion = v_observacion
  where id = (select h.id from public.historial_estados_pedido h where h.pedido_id = v_pedido.id and h.estado_nuevo = 'listo_despacho' order by h.fecha_creacion desc, h.id desc limit 1);
  return query select v_pedido.id, 'listo_despacho'::public.estado_pedido, case when v_completa then 'completa' else 'incompleta' end, v_subtotal, v_total;
end;
$$;


-- CREATE OR REPLACE conserva owners, firmas y ACL de las cuatro RPC.
commit;
