-- Corrige la ambigüedad entre la columna item_pedido_id y la columna de salida
-- de la RPC P2 al resolver el conflicto por su constraint explícito.

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

alter function public.guardar_preparacion_item_pedido_administrativo(uuid, numeric, text) owner to postgres;
revoke all on function public.guardar_preparacion_item_pedido_administrativo(uuid, numeric, text) from public, anon, authenticated;
grant execute on function public.guardar_preparacion_item_pedido_administrativo(uuid, numeric, text) to authenticated;
