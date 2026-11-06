-- Solo contenedor local aislado. Todas las modificaciones se revierten.
\set ON_ERROR_STOP on
begin;
set local plpgsql.check_asserts=on;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claims','{"role":"authenticated","sub":"11111111-1111-4111-8111-111111111111"}',true);
do $$
declare d jsonb; v_id uuid; v_item uuid; v_producto uuid:=gen_random_uuid(); v_presentacion uuid:=gen_random_uuid(); v_categoria uuid; v_nueva uuid; v_antes jsonb;
begin
 select datos into strict d from auditoria_local.fixtures_fase1 where caso like '%editar-editar' order by caso desc limit 1;
 v_id:=(d->>'id')::uuid;v_item:=(d->>'item')::uuid;
 select categoria_id into v_categoria from productos where id=(select producto_id from presentaciones_producto where id=(d->>'presentacion')::uuid);
 insert into productos(id,categoria_id,nombre,slug,unidad_base) values(v_producto,v_categoria,'SINTETICO NUEVO','test-'||v_producto,'comercial');
 insert into presentaciones_producto(id,producto_id,nombre,cantidad,unidad,precio_neto,precio_final,es_principal) values(v_presentacion,v_producto,'Kilo',1,'KG',3000,3570,true);
 -- Línea nueva captura precio actual; retirar/reactivar conserva el precio original.
 execute 'set local role authenticated';
 perform editar_posible_pedido_administrativo(v_id,3,gen_random_uuid(),jsonb_build_array(jsonb_build_object('presentacion_id',v_presentacion,'cantidad',1)));
 assert (select not activo and precio_venta_original_snapshot=1190 from items_posible_pedido where id=v_item);
 select id into v_nueva from items_posible_pedido where posible_pedido_id=v_id and presentacion_producto_id=v_presentacion;
 assert (select precio_venta_original_snapshot=3570 from items_posible_pedido where id=v_nueva);
 begin
  perform editar_posible_pedido_administrativo(v_id,4,gen_random_uuid(),jsonb_build_array(jsonb_build_object('presentacion_id',(d->>'presentacion')::uuid,'cantidad',1)));
  raise exception 'FALTO_EVITAR_RECOTIZACION';
 exception when others then if sqlerrm<>'PRESENTACION_EXISTENTE_USAR_ITEM_ID' then raise;end if;end;
 perform editar_posible_pedido_administrativo(v_id,4,gen_random_uuid(),jsonb_build_array(jsonb_build_object('item_id',v_item,'cantidad',2),jsonb_build_object('item_id',v_nueva,'cantidad',1)));
 assert (select activo and precio_venta_original_snapshot=1190 from items_posible_pedido where id=v_item);
 -- Snapshots inmutables y autorización sin evento rechazada por constraint diferido.
 execute 'reset role';
 begin
  update items_posible_pedido set precio_venta_original_snapshot=9999 where id=v_item;
  raise exception 'FALTO_SNAPSHOT_INMUTABLE';
 exception when others then if sqlerrm<>'SNAPSHOT_POSIBLE_PEDIDO_INMUTABLE' then raise;end if;end;
 begin
  update items_posible_pedido set precio_neto_autorizado=800,precio_venta_autorizado=900,precio_autorizado_por=auth.uid(),fecha_autorizacion_precio=clock_timestamp(),motivo_autorizacion_precio='SIN AUDITORIA' where id=v_item;
  set constraints all immediate;
  raise exception 'FALTO_AUDITORIA';
 exception when others then if sqlerrm<>'AUDITORIA_PRECIO_REQUERIDA' then raise;end if;end;
 set constraints all deferred;
 execute 'set local role authenticated';
 perform descartar_posible_pedido(v_id,5,gen_random_uuid(),'TEST CIERRE');
 begin
  perform editar_posible_pedido_administrativo(v_id,6,gen_random_uuid(),jsonb_build_array(jsonb_build_object('item_id',v_item,'cantidad',2)));
  raise exception 'FALTO_CIERRE';
 exception when others then if sqlerrm<>'POSIBLE_PEDIDO_CERRADO' then raise;end if;end;
 execute 'reset role';
 -- Cantidades extremas y duplicados se rechazan antes de escribir.
 begin
  perform public.pp_normalizar_items(jsonb_build_array(jsonb_build_object('presentacion_id',v_presentacion,'cantidad',100001)));
  raise exception 'FALTO_LIMITE';
 exception when others then if sqlerrm<>'CANTIDAD_INVALIDA' then raise;end if;end;
 begin
  perform public.pp_normalizar_items(jsonb_build_array(jsonb_build_object('presentacion_id',v_presentacion,'cantidad',1),jsonb_build_object('presentacion_id',v_presentacion,'cantidad',1)));
  raise exception 'FALTO_DUPLICADO';
 exception when others then if sqlerrm<>'PRESENTACION_DUPLICADA' then raise;end if;end;
end $$;
set constraints all immediate;
rollback;
