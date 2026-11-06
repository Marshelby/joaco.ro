-- Ejecutado mediante scripts/validar-fase1-local.py. Solo PostgreSQL/Supabase AISLADO ya migrado y con admin fixture.
-- psql -X "$URL_LOCAL" -v ON_ERROR_STOP=1 -v admin_uuid=UUID_ADMIN_FIXTURE -f este_archivo
-- Requiere marcador de base app.hidro_test_aislado=si, configurado por el operador.
-- Siempre ROLLBACK. No ejecutar contra producción aunque exista ese marcador.
\set ON_ERROR_STOP on
begin;
set local plpgsql.check_asserts = on;
select set_config('test.admin_uuid', :'admin_uuid', true);
do $pruebas$
declare
  v_admin uuid := current_setting('test.admin_uuid')::uuid;
  v_categoria uuid := gen_random_uuid(); v_producto uuid := gen_random_uuid();
  v_presentacion uuid := gen_random_uuid(); v_cliente uuid := gen_random_uuid();
  v_zona uuid := gen_random_uuid(); v_direccion uuid := gen_random_uuid();
  v_clave uuid := gen_random_uuid(); v_operacion uuid; v_id uuid; v_item uuid;
  v_secreto text := repeat('a',64); v_fecha date; v_lunes date;
  v_items jsonb; v_original jsonb; v_respuesta jsonb; v_version bigint;
  v_pedido uuid; v_neto bigint; v_venta bigint; v_resultado jsonb;
  v_rol text; v_tabla text; v_dia integer; v_antes_contable jsonb; v_antes_saldos jsonb; v_antes_pedidos jsonb; v_antes_pagos jsonb; v_actual jsonb;
begin
  if current_setting('app.hidro_test_aislado', true) is distinct from 'si'
    or current_user <> 'postgres' then raise exception 'SOLO_BASE_AISLADA_COMO_POSTGRES'; end if;
  if not exists (select 1 from public.perfiles where usuario_id=v_admin and rol='admin') then
    raise exception 'FALTA_ADMIN_FIXTURE'; end if;
  select coalesce(jsonb_agg(to_jsonb(p) order by p.id),'[]') into v_antes_pedidos from public.pedidos p;
  select coalesce(jsonb_agg(to_jsonb(p) order by p.id),'[]') into v_antes_pagos from public.pagos p;

  select jsonb_build_object('aplicaciones',coalesce((select jsonb_agg(to_jsonb(x)) from public.aplicaciones_pago x),'[]'),
    'ajustes',coalesce((select jsonb_agg(to_jsonb(x)) from public.ajustes_cuenta_cliente x),'[]')) into v_antes_contable;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.cliente_id),'[]') into v_antes_saldos from public.v_saldos_cuenta_clientes x;
  -- Fixtures propias: no hay IDs comerciales compartidos con otra prueba.
  insert into public.categorias(id,nombre,slug) values(v_categoria,'TEST PP','test-pp-'||v_categoria::text);
  insert into public.productos(id,categoria_id,nombre,slug,unidad_base)
    values(v_producto,v_categoria,'TEST PP','test-pp-'||v_producto::text,'comercial');
  insert into public.presentaciones_producto(id,producto_id,nombre,cantidad,unidad,precio_neto,precio_final,es_principal)
    values(v_presentacion,v_producto,'Kilo',1,'KG',1000,1190,true);
  insert into public.clientes(id,nombre) values(v_cliente,'TEST PP');
  insert into public.zonas_entrega(id,nombre,slug,comuna_base)
    values(v_zona,'TEST PP','test-pp-'||v_zona::text,'TEST');
  insert into public.direcciones_cliente(id,cliente_id,direccion,comuna,region,zona_entrega_id,latitud,longitud)
    values(v_direccion,v_cliente,'TEST','TEST','Región de Valparaíso',v_zona,-33,-71);

  -- 4: corte exacto. Modificación únicamente temporal en esta base aislada.
  update public.dias_entrega set activo=(dia_semana in (1,2,5)),dias_anticipacion_corte=0,hora_corte='08:00';
  v_lunes := (clock_timestamp() at time zone 'America/Santiago')::date;
  v_lunes := v_lunes + (8-extract(isodow from v_lunes)::integer);
  assert public.fecha_entrega_disponible(v_lunes,(v_lunes+time '07:59') at time zone 'America/Santiago');
  assert not public.fecha_entrega_disponible(v_lunes,(v_lunes+time '08:00') at time zone 'America/Santiago');
  assert (select count(*) <= 3 from public.pp_fechas_validas((v_lunes+time '07:59') at time zone 'America/Santiago'));
  for v_dia in 0..6 loop
    assert public.fecha_entrega_disponible(v_lunes+v_dia,((v_lunes+v_dia)+time '07:59') at time zone 'America/Santiago') = (v_dia in (0,1,4));
    assert not public.fecha_entrega_disponible(v_lunes+v_dia,((v_lunes+v_dia)+time '08:00') at time zone 'America/Santiago');
  end loop;
  update public.dias_entrega set activo=true,dias_anticipacion_corte=0,hora_corte='23:59:59';
  select f.fecha into v_fecha from public.obtener_fechas_posibles_pedidos() f
    where f.fecha > (clock_timestamp() at time zone 'America/Santiago')::date order by f.fecha limit 1;
  assert v_fecha is not null;
  v_items := jsonb_build_array(jsonb_build_object('presentacion_id',v_presentacion,'cantidad',1.5));

  -- 1,2: visitante registrado solo a través del rol de servidor, sin auth.uid.
  perform set_config('request.jwt.claims','{"role":"service_role"}',true);
  perform set_config('request.jwt.claim.role','service_role',true);
  perform set_config('request.jwt.claim.sub','',true);
  execute 'set local role service_role';
  v_original := public.registrar_posible_pedido_whatsapp('Prueba','+56 9 0000 0001',v_fecha,null,v_items,v_clave,v_secreto);
  assert not (v_original ?| array['telefono','nombre','secreto_reintento_hash','huella_solicitud']);
  -- 11: no recotizar ni crear duplicados.
  v_respuesta := public.registrar_posible_pedido_whatsapp('Prueba','+56 9 0000 0001',v_fecha,null,v_items,v_clave,v_secreto);
  assert v_respuesta = v_original;
  -- 12: mismo intento con otro contenido o secreto.
  begin
    perform public.registrar_posible_pedido_whatsapp('Otro','+56 9 0000 0001',v_fecha,null,v_items,v_clave,v_secreto);
    raise exception 'FALTO_CONFLICTO';
  exception when others then if sqlerrm <> 'REINTENTO_INVALIDO' then raise; end if; end;
  begin
    perform public.registrar_posible_pedido_whatsapp('Prueba','+56 9 0000 0001',v_fecha,null,v_items,v_clave,repeat('b',64));
    raise exception 'FALTO_CONFLICTO';
  exception when others then if sqlerrm <> 'REINTENTO_INVALIDO' then raise; end if; end;
  -- 3: fecha fuera de opciones.
  begin
    perform public.registrar_posible_pedido_whatsapp('Prueba','900000001',v_fecha+30,null,v_items,gen_random_uuid(),v_secreto);
    raise exception 'FALTO_ERROR_FECHA';
  exception when others then if sqlerrm <> 'FECHA_FUERA_DE_OPCIONES' then raise; end if; end;
  execute 'reset role';
  select id into v_id from public.posibles_pedidos where codigo_publico=v_original->>'codigo';
  select id into v_item from public.items_posible_pedido where posible_pedido_id=v_id;
  assert (select count(*)=1 from public.posibles_pedidos where clave_idempotencia=v_clave);
  assert (select usuario_id is null from public.clientes where id=v_cliente);
  -- 18: ninguna venta oficial/deuda antes de convertir.
  assert not exists(select 1 from public.pedidos where cliente_id=v_cliente);
  assert not exists(select 1 from public.v_movimientos_cuenta_cliente where cliente_id=v_cliente);

  -- 5: producto inactivo; 6: presentación inexistente.
  update public.productos set activo=false where id=v_producto;
  execute 'set local role service_role';
  begin
    perform public.registrar_posible_pedido_whatsapp('Prueba','900000001',v_fecha,null,v_items,gen_random_uuid(),v_secreto);
    raise exception 'FALTO_PRODUCTO_INACTIVO';
  exception when others then if sqlerrm <> 'PRODUCTO_NO_DISPONIBLE' then raise; end if; end;
  begin
    perform public.registrar_posible_pedido_whatsapp('Prueba','900000001',v_fecha,null,
      jsonb_build_array(jsonb_build_object('presentacion_id',gen_random_uuid(),'cantidad',1)),gen_random_uuid(),v_secreto);
    raise exception 'FALTO_PRESENTACION_INVALIDA';
  exception when others then if sqlerrm <> 'PRODUCTO_NO_DISPONIBLE' then raise; end if; end;
  execute 'reset role';
  update public.productos set activo=true where id=v_producto;
  -- 7: reglas compartidas fracción y cerrado.
  assert public.es_cantidad_pedido_valida('KG',1,'Kilo',0.5);
  assert not public.es_cantidad_pedido_valida('KG',1,'Kilo',0.25);
  assert not public.es_cantidad_pedido_valida('KG',1,'Caja',0.5);

  -- 8: cambios de precios no afectan registro/reintento ni conversión posterior.
  update public.presentaciones_producto set precio_neto=2000,precio_final=2380 where id=v_presentacion;
  execute 'set local role service_role';
  v_respuesta := public.registrar_posible_pedido_whatsapp('Prueba','900000001',v_fecha,null,v_items,v_clave,v_secreto);
  assert v_respuesta=v_original;
  execute 'reset role';

  -- 13: ACL anónima, usuario sin admin y escritura directa incluso admin.
  assert not has_function_privilege('anon','public.registrar_posible_pedido_whatsapp(text,text,date,text,jsonb,uuid,text)','execute');
  assert not has_function_privilege('authenticated','public.registrar_posible_pedido_whatsapp(text,text,date,text,jsonb,uuid,text)','execute');
  assert not has_table_privilege('service_role','public.posibles_pedidos','insert');
  assert not has_table_privilege('authenticated','public.posibles_pedidos','update');
  perform set_config('request.jwt.claim.role','authenticated',true);
  perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
  perform set_config('request.jwt.claims','{"role":"authenticated"}',true);
  execute 'set local role authenticated';
  assert (select count(*)=0 from public.posibles_pedidos);
  assert (select count(*)=0 from public.items_posible_pedido);
  assert (select count(*)=0 from public.historial_posibles_pedidos);
  assert (select count(*)=0 from public.vinculos_items_posible_pedido);
  begin
    perform public.descartar_posible_pedido(v_id,1,gen_random_uuid(),'TEST');
    raise exception 'FALTO_NO_AUTORIZADO';
  exception when others then if sqlerrm <> 'NO_AUTORIZADO' then raise; end if; end;
  execute 'reset role';
  perform set_config('request.jwt.claim.sub',v_admin::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',v_admin)::text,true);
  execute 'set local role authenticated';

  -- Calendario: firma nueva acepta 0 y valores mayores; la antigua conserva 0.
  perform public.guardar_dia_entrega_administrativo(1::smallint,true,time '08:00',0::smallint);
  perform public.guardar_dia_entrega_administrativo(1::smallint,true,time '08:00');
  assert (select dias_anticipacion_corte=0 from public.dias_entrega where dia_semana=1);
  perform public.guardar_dia_entrega_administrativo(1::smallint,true,time '08:00',2::smallint);
  assert (select dias_anticipacion_corte=2 from public.dias_entrega where dia_semana=1);
  perform public.guardar_dia_entrega_administrativo(1::smallint,true,time '23:59:59',0::smallint);

  -- ACL efectiva: cuatro contextos, cuatro tablas, DML y RPCs internas.
  execute 'reset role';
  foreach v_rol in array array['anon','authenticated','service_role'] loop
    execute format('set local role %I',v_rol);
    foreach v_tabla in array array['posibles_pedidos','items_posible_pedido','historial_posibles_pedidos','vinculos_items_posible_pedido'] loop
      begin
        execute format('delete from public.%I where false',v_tabla);
        raise exception 'FALTO_DENEGAR_DELETE';
      exception when insufficient_privilege then null; end;
      begin
        execute format('update public.%I set %I=%I where false',v_tabla,case when v_tabla='vinculos_items_posible_pedido' then 'item_posible_pedido_id' else 'id' end,case when v_tabla='vinculos_items_posible_pedido' then 'item_posible_pedido_id' else 'id' end);
        raise exception 'FALTO_DENEGAR_UPDATE';
      exception when insufficient_privilege then null; end;
      begin
        execute format('insert into public.%I default values',v_tabla);
        raise exception 'FALTO_DENEGAR_INSERT';
      exception when insufficient_privilege then null; end;
    end loop;
    begin perform public.pp_resultado_admin(v_id); raise exception 'HELPER_PUBLICO';
    exception when insufficient_privilege then null; end;
    if v_rol='anon' then
      begin perform 1 from public.posibles_pedidos; raise exception 'LECTURA_ANON';
      exception when insufficient_privilege then null; end;
    end if;
    execute 'reset role';
  end loop;
  execute 'set local role authenticated';
  assert (select count(*)=1 from public.posibles_pedidos where id=v_id);
  -- 9: misma línea y precio original; repetir devuelve resultado sin nueva versión.
  v_operacion:=gen_random_uuid();
  v_resultado:=public.editar_posible_pedido_administrativo(v_id,1,v_operacion,
    jsonb_build_array(jsonb_build_object('item_id',v_item,'cantidad',2)));
  assert (v_resultado->>'version')::bigint=2;
  assert public.editar_posible_pedido_administrativo(v_id,1,v_operacion,
    jsonb_build_array(jsonb_build_object('item_id',v_item,'cantidad',2)))=v_resultado;
  assert (select precio_venta_original_snapshot=1190 from public.items_posible_pedido where id=v_item);

  -- 10: autorizaciones encadenadas en una transacción ejercitan la correctiva.
  v_resultado:=public.autorizar_precio_posible_pedido(v_id,2,gen_random_uuid(),v_item,900,1100,'TEST uno');
  v_resultado:=public.autorizar_precio_posible_pedido(v_id,3,gen_random_uuid(),v_item,950,1150,'TEST dos');
  set constraints all immediate;
  set constraints all deferred;
  assert (select precio_venta_original_snapshot=1190 and precio_venta_autorizado=1150
    from public.items_posible_pedido where id=v_item);
  assert (select count(*)=2 from public.historial_posibles_pedidos where posible_pedido_id=v_id and evento='autorizacion_precio');
  -- La clave administrativa no puede reutilizarse con parámetros diferentes.
  begin
    perform public.editar_posible_pedido_administrativo(v_id,1,v_operacion,
      jsonb_build_array(jsonb_build_object('item_id',v_item,'cantidad',3)));
    raise exception 'FALTO_CONFLICTO_OPERACION';
  exception when others then if sqlerrm <> 'CLAVE_OPERACION_EN_USO' then raise; end if; end;
  v_resultado:=public.asociar_cliente_posible_pedido(v_id,4,gen_random_uuid(),v_cliente);

  -- Validaciones y atomicidad antes de la conversión válida.
  begin
    perform public.convertir_posible_pedido_administrativo(v_id,5,gen_random_uuid(),v_direccion,v_fecha,array['invalido']);
    raise exception 'FALTO_METODO';
  exception when others then if sqlerrm <> 'METODOS_PAGO_INVALIDOS' then raise; end if; end;
  execute 'reset role';
  update public.direcciones_cliente set activa=false where id=v_direccion;
  execute 'set local role authenticated';
  begin
    perform public.convertir_posible_pedido_administrativo(v_id,5,gen_random_uuid(),v_direccion,v_fecha,array['efectivo']);
    raise exception 'FALTO_DIRECCION';
  exception when others then if sqlerrm <> 'DIRECCION_INVALIDA' then raise; end if; end;
  execute 'reset role';
  update public.direcciones_cliente set activa=true where id=v_direccion;
  update public.zonas_entrega set activa=false where id=v_zona;
  execute 'set local role authenticated';
  begin
    perform public.convertir_posible_pedido_administrativo(v_id,5,gen_random_uuid(),v_direccion,v_fecha,array['efectivo']);
    raise exception 'FALTO_ZONA';
  exception when others then if sqlerrm <> 'ZONA_INVALIDA' then raise; end if; end;
  execute 'reset role';
  update public.zonas_entrega set activa=true where id=v_zona;
  -- Fallo inyectado al insertar líneas: toda cabecera/conversión debe revertir.
  execute $sql$create function public.test_fallar_item_fase1() returns trigger language plpgsql as 'begin raise exception ''FALLO_INYECTADO_FASE1''; end;'$sql$;
  execute 'create trigger test_fallar_item_fase1 before insert on public.items_pedido for each row execute function public.test_fallar_item_fase1()';
  execute 'set local role authenticated';
  begin
    perform public.convertir_posible_pedido_administrativo(v_id,5,gen_random_uuid(),v_direccion,v_fecha,array['efectivo']);
    raise exception 'FALTO_FALLO_INYECTADO';
  exception when others then if sqlerrm <> 'FALLO_INYECTADO_FASE1' then raise; end if; end;
  assert (select estado='en_gestion' and version=5 and pedido_oficial_id is null from public.posibles_pedidos where id=v_id);
  assert not exists(select 1 from public.pedidos where cliente_id=v_cliente);
  execute 'reset role';
  execute 'drop trigger test_fallar_item_fase1 on public.items_pedido';
  execute 'drop function public.test_fallar_item_fase1()';
  execute 'set local role authenticated';
  assert not exists(select 1 from public.v_movimientos_cuenta_cliente where cliente_id=v_cliente);
  -- 15: vencida, sin efectos oficiales.
  begin
    perform public.convertir_posible_pedido_administrativo(v_id,5,gen_random_uuid(),v_direccion,v_fecha-30,array['efectivo']);
    raise exception 'FALTO_FECHA_VENCIDA';
  exception when others then if sqlerrm <> 'FECHA_ENTREGA_NO_DISPONIBLE' then raise; end if; end;
  execute 'reset role';
  update public.presentaciones_producto set cantidad=2 where id=v_presentacion;
  execute 'set local role authenticated';
  -- 16: cambió formato/cantidad, revisión obligatoria.
  begin
    perform public.convertir_posible_pedido_administrativo(v_id,5,gen_random_uuid(),v_direccion,v_fecha,array['efectivo']);
    raise exception 'FALTO_REVISION_FORMATO';
  exception when others then if sqlerrm <> 'PRESENTACION_MODIFICADA_REQUIERE_REVISION' then raise; end if; end;
  execute 'reset role';
  update public.presentaciones_producto set cantidad=1 where id=v_presentacion;
  execute 'set local role authenticated';
  -- 17,19: precios efectivos históricos y conversión exactamente una vez.
  v_resultado:=public.convertir_posible_pedido_administrativo(v_id,5,gen_random_uuid(),v_direccion,v_fecha,array['efectivo']);
  v_pedido:=(v_resultado->>'pedido_id')::uuid;
  assert public.convertir_posible_pedido_administrativo(v_id,5,gen_random_uuid(),v_direccion,v_fecha,array['efectivo'])=v_resultado;
  assert (select count(*)=1 from public.pedidos where cliente_id=v_cliente);
  assert (select precio_neto_unitario_snapshot=950 and precio_final_unitario_snapshot=1150 and cantidad=2 and total_linea=2300
    from public.items_pedido where pedido_id=v_pedido);
  assert (select count(*)=1 from public.vinculos_items_posible_pedido where item_posible_pedido_id=v_item);
  assert (select estado='convertido' and version=6 from public.posibles_pedidos where id=v_id);
  execute 'reset role';
  -- 20: pedidos previos y pagos idénticos. La venta nueva es el único efecto.
  select coalesce(jsonb_agg(to_jsonb(p) order by p.id),'[]') into v_actual from public.pedidos p where p.id<>v_pedido;
  assert v_actual=v_antes_pedidos;
  select coalesce(jsonb_agg(to_jsonb(p) order by p.id),'[]') into v_actual from public.pagos p;
  assert v_actual=v_antes_pagos;
  assert exists(select 1 from public.v_movimientos_cuenta_cliente where cliente_id=v_cliente and tipo_movimiento='pedido');
  assert v_antes_contable=jsonb_build_object('aplicaciones',coalesce((select jsonb_agg(to_jsonb(x)) from public.aplicaciones_pago x),'[]'),
    'ajustes',coalesce((select jsonb_agg(to_jsonb(x)) from public.ajustes_cuenta_cliente x),'[]'));
  assert (select sum(movimiento_neto)=(select total from public.pedidos where id=v_pedido) from public.v_movimientos_cuenta_cliente where cliente_id=v_cliente);
  assert v_antes_saldos=(select coalesce(jsonb_agg(to_jsonb(x) order by x.cliente_id),'[]') from public.v_saldos_cuenta_clientes x where x.cliente_id<>v_cliente);
  raise notice 'Pruebas secuenciales terminadas. Falta prueba concurrente en dos sesiones (ver documento).';
end;
$pruebas$;
set constraints all immediate;
rollback;
