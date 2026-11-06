-- Bloque 1, microintegración 5/8. Depende de 010000, 030000 y 040000.
begin;
alter table public.preparacion_items_pedido
  add column confirmado_explicito boolean not null default false,
  add column importe_linea_operativo bigint check (importe_linea_operativo >= 0),
  add constraint preparacion_confirmada_requiere_importe check (not confirmado_explicito or importe_linea_operativo is not null);
-- Sin backfill: las excepciones antiguas siguen disponibles, pero no confirman productos.
alter table public.pedidos add column total_operativo_preparacion bigint check (total_operativo_preparacion >= 0);
-- Las dependencias SQL antiguas conservan su referencia al alias histórico.
-- La contabilidad no comienza a consumir los nuevos importes provisionales.
alter table public.pedidos rename column importe_operativo to importe_operativo_legacy;
alter table public.pedidos add column importe_operativo bigint generated always as
  (coalesce(total_operativo_preparacion, total_final, total)) stored;
comment on column public.pedidos.importe_operativo is 'Importe provisional de preparación; no venta, deuda ni límite de aplicaciones contables.';

-- Retirar rutas sin versión/idempotencia y finalización con prorrateo contable.
revoke execute on function public.guardar_preparacion_item_pedido_administrativo(uuid,numeric,text),
 public.finalizar_preparacion_pedido_administrativo(uuid),
 public.marcar_pedido_listo_despacho_administrativo(uuid)
 from public, anon, authenticated, service_role;

create function public.leer_preparacion_explicita(p_pedido_id uuid)
returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
begin
 if auth.uid() is null or not coalesce(public.es_admin(),false) then raise exception 'NO_AUTORIZADO'; end if;
 return jsonb_build_object('importe_operativo',(select importe_operativo from public.pedidos where id=p_pedido_id),'version',coalesce((select version from operativo_privado.versiones_pedido where pedido_id=p_pedido_id),0),
 'historial',coalesce((select jsonb_agg(to_jsonb(h) - 'solicitud' - 'resultado' order by h.version desc) from operativo_privado.historial_operativo h where h.pedido_id=p_pedido_id and h.operacion in ('preparar_producto','cerrar_preparacion')),'[]'::jsonb));
end; $$;

create function public.confirmar_producto_preparado(
 p_item_pedido_id uuid, p_cantidad numeric, p_importe bigint,
 p_version_esperada bigint, p_clave uuid, p_motivo text
) returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare
 v_id uuid; v_p public.pedidos%rowtype; v_i public.items_pedido%rowtype;
 v_anterior jsonb; v_nuevo jsonb; v_solicitud jsonb; v_inicio jsonb; v_modo text; v_importe bigint; v_total bigint;
begin
 if auth.uid() is null or not coalesce(public.es_admin(),false) then raise exception 'NO_AUTORIZADO'; end if;
 select pedido_id into v_id from public.items_pedido where id=p_item_pedido_id;
 if not found then raise exception 'ITEM_PEDIDO_NO_ENCONTRADO'; end if;
 v_solicitud:=jsonb_build_object('item',p_item_pedido_id,'cantidad',p_cantidad,'importe',p_importe,'motivo',p_motivo);
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
 if p_cantidad<>v_i.cantidad and (p_importe is null or p_importe<0 or p_importe>9007199254740991) then raise exception 'IMPORTE_MANUAL_REQUERIDO'; end if;
 if p_cantidad=v_i.cantidad and p_importe is not null and p_importe<>v_i.total_linea then raise exception 'IMPORTE_ORIGINAL_REQUERIDO'; end if;
 v_importe:=case when p_cantidad=v_i.cantidad then v_i.total_linea else p_importe end;
 select to_jsonb(pi) into v_anterior from public.preparacion_items_pedido pi where item_pedido_id=v_i.id for update;
 if v_p.fecha_entrega is distinct from (clock_timestamp() at time zone 'America/Santiago')::date then raise exception 'PREPARACION_FECHA_NO_HABILITADA'; end if;
 v_anterior:=coalesce(v_anterior,jsonb_build_object('confirmado_explicito',false,'cantidad_preparada',null,'importe_linea_operativo',null)) || jsonb_build_object('cantidad_original',v_i.cantidad,'importe_original',v_i.total_linea);
 insert into public.preparacion_items_pedido(pedido_id,item_pedido_id,cantidad_preparada,importe_linea_operativo,confirmado_explicito,motivo_faltante,registrado_por)
 values(v_id,v_i.id,p_cantidad,v_importe,true,p_motivo,auth.uid())
 on conflict on constraint preparacion_items_pedido_item_pedido_id_key do update set
 cantidad_preparada=excluded.cantidad_preparada,importe_linea_operativo=excluded.importe_linea_operativo,confirmado_explicito=true,motivo_faltante=excluded.motivo_faltante,registrado_por=excluded.registrado_por;
 select to_jsonb(pi) || jsonb_build_object('cantidad_original',v_i.cantidad,'importe_original',v_i.total_linea) into v_nuevo from public.preparacion_items_pedido pi where item_pedido_id=v_i.id;
 -- Pendientes conservan su importe autorizado únicamente para el agregado provisional.
 select sum(case when pi.confirmado_explicito then pi.importe_linea_operativo else i.total_linea end)+v_p.costo_entrega-v_p.descuento
 into v_total from public.items_pedido i left join public.preparacion_items_pedido pi on pi.item_pedido_id=i.id where i.pedido_id=v_id;
 if v_total<0 or v_total>9007199254740991 then raise exception 'TOTAL_FINAL_INVALIDO'; end if;
 update public.pedidos set total_operativo_preparacion=v_total,preparacion_estado='pendiente' where id=v_id;
 return operativo_privado.completar_operacion(v_id,p_version_esperada,p_clave,'preparar_producto',v_solicitud,v_i.id,p_motivo,v_anterior,v_nuevo,jsonb_build_object('guardado',true,'importe_operativo',v_total));
end; $$;

create function public.cerrar_preparacion_explicita(p_pedido_id uuid,p_version_esperada bigint,p_clave uuid)
returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare v_p public.pedidos%rowtype; v_inicio jsonb; v_s jsonb:='{}'; v_distinto boolean;
begin
 if auth.uid() is null or not coalesce(public.es_admin(),false) then raise exception 'NO_AUTORIZADO'; end if;
 v_inicio:=operativo_privado.iniciar_operacion(p_pedido_id,p_version_esperada,p_clave,'cerrar_preparacion',v_s);
 select * into v_p from public.pedidos where id=p_pedido_id for update;
 if v_p.fecha_entrega is distinct from (clock_timestamp() at time zone 'America/Santiago')::date then raise exception 'PREPARACION_FECHA_NO_HABILITADA'; end if;
 if (v_inicio->>'reintento')::boolean then return v_inicio; end if;
 if v_p.estado<>'preparando' or v_p.preparacion_finalizada_en is not null then raise exception 'ESTADO_PEDIDO_INVALIDO'; end if;
 perform 1 from public.items_pedido where pedido_id=p_pedido_id order by id for update;
 perform 1 from public.preparacion_items_pedido where pedido_id=p_pedido_id order by item_pedido_id for update;
 if v_p.fecha_entrega is distinct from (clock_timestamp() at time zone 'America/Santiago')::date then raise exception 'PREPARACION_FECHA_NO_HABILITADA'; end if;
 if not exists(select 1 from public.items_pedido where pedido_id=p_pedido_id) or exists(
 select 1 from public.items_pedido i left join public.preparacion_items_pedido pi on pi.item_pedido_id=i.id
 where i.pedido_id=p_pedido_id and (not coalesce(pi.confirmado_explicito,false) or pi.importe_linea_operativo is null)) then raise exception 'PRODUCTOS_PENDIENTES'; end if;
 select exists(select 1 from public.items_pedido i join public.preparacion_items_pedido pi on pi.item_pedido_id=i.id where i.pedido_id=p_pedido_id and pi.cantidad_preparada<>i.cantidad) into v_distinto;
 update public.pedidos set estado='listo_despacho',preparacion_estado=case when v_distinto then 'incompleta' else 'completa' end,
 preparacion_finalizada_en=clock_timestamp(),preparacion_finalizada_por=auth.uid() where id=p_pedido_id;
 return operativo_privado.completar_operacion(p_pedido_id,p_version_esperada,p_clave,'cerrar_preparacion',v_s,null,'Cierre explícito de preparación',
 jsonb_build_object('estado',v_p.estado,'importe_operativo',v_p.total_operativo_preparacion),
 jsonb_build_object('estado','listo_despacho','importe_operativo',v_p.total_operativo_preparacion),jsonb_build_object('finalizado',true));
end; $$;

alter function public.leer_preparacion_explicita(uuid) owner to postgres;
alter function public.confirmar_producto_preparado(uuid,numeric,bigint,bigint,uuid,text) owner to postgres;
alter function public.cerrar_preparacion_explicita(uuid,bigint,uuid) owner to postgres;
revoke all on function public.leer_preparacion_explicita(uuid),public.confirmar_producto_preparado(uuid,numeric,bigint,bigint,uuid,text),public.cerrar_preparacion_explicita(uuid,bigint,uuid) from public,anon,authenticated,service_role;
grant execute on function public.leer_preparacion_explicita(uuid),public.confirmar_producto_preparado(uuid,numeric,bigint,bigint,uuid,text),public.cerrar_preparacion_explicita(uuid,bigint,uuid) to authenticated;
commit;
