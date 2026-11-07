-- Persistencia parcial sobre el modelo existente. Sin cambios contables ni logísticos.
-- Reutiliza preparar_producto para incluir avances en el historial de preparación.
begin;

create function public.guardar_avance_producto_preparado(
 p_item_pedido_id uuid, p_cantidad numeric,
 p_version_esperada bigint, p_clave uuid
) returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare
 v_id uuid; v_p public.pedidos%rowtype; v_i public.items_pedido%rowtype;
 v_anterior jsonb; v_nuevo jsonb; v_solicitud jsonb; v_inicio jsonb; v_modo text; v_total bigint;
begin
 if auth.uid() is null or not coalesce(public.es_admin(),false) then raise exception 'NO_AUTORIZADO'; end if;
 select pedido_id into v_id from public.items_pedido where id=p_item_pedido_id;
 if not found then raise exception 'ITEM_PEDIDO_NO_ENCONTRADO'; end if;
 v_solicitud:=jsonb_build_object('item',p_item_pedido_id,'cantidad',p_cantidad,'tipo','avance_parcial');
 v_inicio:=operativo_privado.iniciar_operacion(v_id,p_version_esperada,p_clave,'preparar_producto',v_solicitud);
 select * into v_p from public.pedidos where id=v_id for update;
 if v_p.fecha_entrega is distinct from (clock_timestamp() at time zone 'America/Santiago')::date then raise exception 'PREPARACION_FECHA_NO_HABILITADA'; end if;
 if (v_inicio->>'reintento')::boolean then return v_inicio; end if;
 if v_p.estado <> 'preparando' or v_p.preparacion_finalizada_en is not null then raise exception 'ESTADO_PEDIDO_INVALIDO'; end if;
 select * into v_i from public.items_pedido where id=p_item_pedido_id and pedido_id=v_id for update;
 if not found then raise exception 'ITEM_PEDIDO_NO_ENCONTRADO'; end if;
 if v_p.fecha_entrega is distinct from (clock_timestamp() at time zone 'America/Santiago')::date then raise exception 'PREPARACION_FECHA_NO_HABILITADA'; end if;
 if p_cantidad is null or p_cantidad::text in ('NaN','Infinity','-Infinity') or p_cantidad<0 or p_cantidad>=1000000000 or p_cantidad<>round(p_cantidad,3) then raise exception 'CANTIDAD_PREPARADA_INVALIDA'; end if;
 v_modo:=coalesce(v_i.modo_cantidad_snapshot,case
 when lower(coalesce(v_i.nombre_presentacion_snapshot,'')) ~ '(saco|malla|caja|paquete|docena)' then 'presentacion_cerrada'
 when upper(btrim(v_i.unidad_snapshot))='KG' then 'kg_fraccionable' else 'unidad' end);
 if v_modo<>'kg_fraccionable' and p_cantidad<>trunc(p_cantidad) then raise exception 'CANTIDAD_PREPARADA_DEBE_SER_ENTERA'; end if;
 select to_jsonb(pi) into v_anterior from public.preparacion_items_pedido pi where item_pedido_id=v_i.id for update;
 if v_p.fecha_entrega is distinct from (clock_timestamp() at time zone 'America/Santiago')::date then raise exception 'PREPARACION_FECHA_NO_HABILITADA'; end if;
 v_anterior:=coalesce(v_anterior,jsonb_build_object('confirmado_explicito',false,'cantidad_preparada',null,'importe_linea_operativo',null)) || jsonb_build_object('cantidad_original',v_i.cantidad,'importe_original',v_i.total_linea);
 insert into public.preparacion_items_pedido(pedido_id,item_pedido_id,cantidad_preparada,importe_linea_operativo,confirmado_explicito,motivo_faltante,registrado_por)
 values(v_id,v_i.id,p_cantidad,null,false,null,auth.uid())
 on conflict on constraint preparacion_items_pedido_item_pedido_id_key do update set
 cantidad_preparada=excluded.cantidad_preparada,importe_linea_operativo=excluded.importe_linea_operativo,confirmado_explicito=false,motivo_faltante=excluded.motivo_faltante,registrado_por=excluded.registrado_por;
 select to_jsonb(pi) || jsonb_build_object('cantidad_original',v_i.cantidad,'importe_original',v_i.total_linea) into v_nuevo from public.preparacion_items_pedido pi where item_pedido_id=v_i.id;
 -- Pendientes conservan su importe autorizado únicamente para el agregado provisional.
 select sum(case when pi.confirmado_explicito then pi.importe_linea_operativo else i.total_linea end)+v_p.costo_entrega-v_p.descuento
 into v_total from public.items_pedido i left join public.preparacion_items_pedido pi on pi.item_pedido_id=i.id where i.pedido_id=v_id;
 if v_total<0 or v_total>9007199254740991 then raise exception 'TOTAL_FINAL_INVALIDO'; end if;
 update public.pedidos set total_operativo_preparacion=v_total,preparacion_estado='pendiente' where id=v_id;
 return operativo_privado.completar_operacion(v_id,p_version_esperada,p_clave,'preparar_producto',v_solicitud,v_i.id,'Guardado parcial de cantidad cargada; pendiente de confirmación definitiva',v_anterior,v_nuevo,jsonb_build_object('guardado',true,'confirmado_explicito',false,'cantidad_preparada',p_cantidad,'importe_operativo',v_total));
end; $$;

alter function public.guardar_avance_producto_preparado(uuid,numeric,bigint,uuid) owner to postgres;
revoke all on function public.guardar_avance_producto_preparado(uuid,numeric,bigint,uuid) from public,anon,authenticated,service_role;
grant execute on function public.guardar_avance_producto_preparado(uuid,numeric,bigint,uuid) to authenticated;
commit;
