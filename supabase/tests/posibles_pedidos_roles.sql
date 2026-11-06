\set ON_ERROR_STOP on
begin;
set local plpgsql.check_asserts=on;
insert into auth.users(id,raw_user_meta_data) values('33333333-3333-4333-8333-333333333333','{}') on conflict do nothing;
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
select set_config('request.jwt.claims','{"role":"authenticated","sub":"33333333-3333-4333-8333-333333333333"}',true);
do $$
declare rol text; llamada text;
begin
 foreach rol in array array['anon','authenticated','service_role'] loop
  perform set_config('request.jwt.claim.role',rol,true);
  execute format('set local role %I',rol);
  foreach llamada in array array[
   'public.editar_posible_pedido_administrativo(null,1,null,null)',
   'public.autorizar_precio_posible_pedido(null,1,null,null,1,1,null)',
   'public.asociar_cliente_posible_pedido(null,1,null,null)',
   'public.descartar_posible_pedido(null,1,null,null)',
   'public.convertir_posible_pedido_administrativo(null,1,null,null,null,null)'] loop
    begin
     execute 'select '||llamada;
     raise exception 'FALTO_DENEGAR_RPC';
    exception when insufficient_privilege then null;end;
  end loop;
  if rol <> 'service_role' then
   begin
    perform public.registrar_posible_pedido_whatsapp(null,null,null,null,null,null,null);
    raise exception 'FALTO_DENEGAR_REGISTRO';
   exception when insufficient_privilege then null;end;
  end if;
  if rol='authenticated' then
   assert (select count(*)=0 from posibles_pedidos);
   assert (select count(*)=0 from items_posible_pedido);
   assert (select count(*)=0 from historial_posibles_pedidos);
   assert (select count(*)=0 from vinculos_items_posible_pedido);
  end if;
  execute 'reset role';
 end loop;
end $$;
rollback;
