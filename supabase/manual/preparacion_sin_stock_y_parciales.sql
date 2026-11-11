-- Hidro Leufú — instalación MANUAL completa y transaccional. NO EJECUTADA.
-- Requiere migraciones operativas hasta 20261108180000, terminar_ruta_fase2,
-- no_entregados_fase4, repartidores_fase5 y rutas_multiples_fase3_compatibilidad
-- (rutas multi Fase 2 previamente instalada). Ejecutar como postgres en SQL Editor.
-- No backfill, no escrituras contables, no cambios a snapshots históricos.
-- Las huellas son del prosrc LF de los contratos locales, no de texto aproximado.
-- Ante contrato distinto: rollback completo; revisar instalación remota, no omitir controles.
-- Reejecutar esta misma versión conserva datos y respuestas idempotentes.
-- Cargas confirmadas: reabrir antes. Legado contable y referencias históricas
-- incompatibles: bloqueo explícito; requieren el flujo de revisión existente.
begin;
set local lock_timeout='5s';
lock table public.pedidos in exclusive mode nowait;
do $pre$
declare r record; rol text; firma text;
begin
 if current_user<>'postgres' or not exists(select 1 from pg_roles where rolname='postgres' and (rolsuper or rolbypassrls)) then raise exception 'REQUIERE_POSTGRES_BYPASSRLS'; end if;
 if current_setting('transaction_isolation')<>'read committed' or current_setting('session_replication_role')<>'origin' then raise exception 'REQUIERE_READ_COMMITTED_Y_TRIGGERS_ORIGIN'; end if;
 for r in select * from (values
 ('public.leer_carga_jornada(date)',array['p_fecha']::text[],'jsonb','plpgsql','65aa2b97f1ea7eaaec2de0ef93bd2a6d','3ae5b4b136022b8f67729a4144b3cc22'),
 ('public.guardar_avance_producto_preparado(uuid,numeric,bigint,uuid)',array['p_item_pedido_id','p_cantidad','p_version_esperada','p_clave']::text[],'jsonb','plpgsql','765e79172d4d68d4736b6f2874fa96ca','be5338c4deeafd5f00ae86bfa2e21b8d'),
 ('public.confirmar_producto_preparado(uuid,numeric,bigint,bigint,uuid,text)',array['p_item_pedido_id','p_cantidad','p_importe','p_version_esperada','p_clave','p_motivo']::text[],'jsonb','plpgsql','cb85ce3ee2cbe954ad5c7a79c8564299','1485e60ba5c827ec56f653f393ec4f16'),
 ('operativo_privado.proteger_entrega_fallida()',null::text[],'trigger','plpgsql','192cccdf6205e693e1979701bb964a30','a80be58925ab40f7440b9d1c4a9658a7'),
 ('public.leer_mi_reparto()',null::text[],'jsonb','sql','567c7ce7d3f2d00e5889eb530338733a','b65f390394759435c7a99e4dbcd8b748'),
 ('operativo_privado.leer_mi_reparto()',null::text[],'jsonb','sql','f452bfdca20eb40986a3c512a29495c5','350ce5659a5362aadbf1ebe3ecd65aa8'),
 ('operativo_privado.estado_preparacion_multi(uuid)',array['p_pedido']::text[],'text','sql','3db9a95a048f56fe2830c46e960f0325','8739840a9f181dda697cbd5f9c0c9e73'),
 ('public.leer_preparacion_explicita(uuid)',array['p_pedido_id']::text[],'jsonb','plpgsql','d277571a02ab7d68ffc1f100d6fd3380','f528943f4bfabe84eaa93139dc02d233'),
 ('public.cerrar_preparacion_explicita(uuid,bigint,uuid)',array['p_pedido_id','p_version_esperada','p_clave']::text[],'jsonb','plpgsql','47e2d506c7211d3693747831ee4754f1','726d98b063f453197206c903af1ff292')
 ) v(firma,nombres,retorno,lenguaje,anterior,nueva) loop
 if not exists(select 1 from pg_proc p join pg_language l on l.oid=p.prolang
 where p.oid=to_regprocedure(r.firma) and p.proowner='postgres'::regrole
 and p.prokind='f' and p.prorettype=to_regtype(r.retorno) and not p.proretset
 and p.prosecdef and not p.proisstrict and p.pronargdefaults=0
 and p.proargnames is not distinct from r.nombres and l.lanname=r.lenguaje
 and p.proconfig @> array['search_path=pg_catalog']::text[]
 and md5(replace(p.prosrc,chr(13)||chr(10),chr(10))) in (r.anterior,r.nueva)) then raise exception 'CONTRATO_INSTALADO_INCOMPATIBLE: %',r.firma; end if;
 end loop;
 foreach firma in array array[
 'operativo_privado.iniciar_operacion(uuid,bigint,uuid,text,jsonb)',
 'operativo_privado.completar_operacion(uuid,bigint,uuid,text,jsonb,uuid,text,jsonb,jsonb,jsonb)',
 'operativo_privado.permite_reprogramacion(oid,jsonb,jsonb)',
 'operativo_privado.cantidades_ruta_multi(uuid)', 'operativo_privado.snapshot_ruta_multi(uuid)',
 'public.operar_ruta_multiple(jsonb)', 'public.leer_rutas_multiples(date)',
 'public.leer_carga_jornada(date)', 'public.leer_intentos_pedido_admin(uuid)'] loop
 if not exists(select 1 from pg_proc where oid=to_regprocedure(firma) and proowner='postgres'::regrole) then raise exception 'DEPENDENCIA_NO_INSTALADA: %',firma; end if;
 end loop;
 foreach rol in array array['anon','authenticated','service_role'] loop
 if has_schema_privilege(rol,'operativo_privado','USAGE') or has_schema_privilege(rol,'operativo_privado','CREATE') or has_schema_privilege(rol,'public','CREATE') then raise exception 'ESQUEMA_NO_AISLADO: %',rol; end if;
 end loop;
 if not exists(select 1 from pg_trigger where tgrelid='public.pedidos'::regclass
 and tgname='proteger_entrega_fallida' and tgfoid=to_regprocedure('operativo_privado.proteger_entrega_fallida()')
 and tgtype=23 and tgenabled in ('O','A') and not tgisinternal and tgqual is null and tgnargs=0
 and (tgattr::text='' or tgattr::text=(select attnum::text from pg_attribute where attrelid='public.pedidos'::regclass and attname='estado'))) then raise exception 'BARRERA_FALLO_NO_ACTIVA'; end if;
 foreach firma in array array['operativo_privado.rutas_multi','operativo_privado.ruta_multi_pedidos','operativo_privado.ruta_multi_autorizaciones','operativo_privado.ruta_multi_eventos','operativo_privado.versiones_pedido','operativo_privado.historial_operativo','operativo_privado.cargas','operativo_privado.carga_pedidos','operativo_privado.historial_cargas','operativo_privado.entregas_definitivas','operativo_privado.cobros_entrega','operativo_privado.pagos_entrega'] loop
 if not exists(select 1 from pg_class where oid=to_regclass(firma) and relkind='r' and relowner='postgres'::regrole and relrowsecurity and relforcerowsecurity) then raise exception 'TABLA_PRIVADA_INCOMPATIBLE: %',firma; end if;
 if exists(select 1 from pg_policy where polrelid=to_regclass(firma)) then raise exception 'POLITICAS_PRIVADAS_INCOMPATIBLES: %',firma; end if;
 foreach rol in array array['anon','authenticated','service_role'] loop
 if has_table_privilege(rol,to_regclass(firma),'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') then raise exception 'TABLA_PRIVADA_NO_AISLADA: %',firma; end if;
 end loop;
 end loop;
 if exists(select 1 from public.preparacion_items_pedido pi left join public.items_pedido i on i.id=pi.item_pedido_id where i.id is null or pi.pedido_id is distinct from i.pedido_id) then raise exception 'PREPARACION_INCOHERENTE_PREEXISTENTE'; end if;
 if to_regprocedure('public.cerrar_preparacion_autorizada(uuid,bigint,uuid,text,boolean)') is not null and not exists(select 1 from pg_proc where oid=to_regprocedure('public.cerrar_preparacion_autorizada(uuid,bigint,uuid,text,boolean)') and proowner='postgres'::regrole and prorettype='jsonb'::regtype and not proretset and prosecdef and proargnames=array['p_pedido_id','p_version_esperada','p_clave','p_motivo','p_autoriza_parcial']::text[] and md5(replace(prosrc,chr(13)||chr(10),chr(10)))='f80b8eeb19134ff07125478a62a7c36d') then raise exception 'RPC_NUEVA_YA_INSTALADA_CON_OTRO_CONTRATO: public.cerrar_preparacion_autorizada(uuid,bigint,uuid,text,boolean)'; end if;
 if to_regprocedure('public.resolver_pedido_sin_stock(uuid,bigint,uuid,text,boolean)') is not null and not exists(select 1 from pg_proc where oid=to_regprocedure('public.resolver_pedido_sin_stock(uuid,bigint,uuid,text,boolean)') and proowner='postgres'::regrole and prorettype='jsonb'::regtype and not proretset and prosecdef and proargnames=array['p_pedido_id','p_version_esperada','p_clave','p_motivo','p_confirmado']::text[] and md5(replace(prosrc,chr(13)||chr(10),chr(10)))='c0dd876a5207b727a6563c3c73d8656b') then raise exception 'RPC_NUEVA_YA_INSTALADA_CON_OTRO_CONTRATO: public.resolver_pedido_sin_stock(uuid,bigint,uuid,text,boolean)'; end if;
 -- Las dependencias no se sustituyen: exigir sus cuerpos conocidos completos.
 for r in select * from (values
 ('operativo_privado.iniciar_operacion(uuid,bigint,uuid,text,jsonb)','851bd503a2d01c8719fbfb7db13b98ca'),
 ('operativo_privado.completar_operacion(uuid,bigint,uuid,text,jsonb,uuid,text,jsonb,jsonb,jsonb)','fb362346c9e3178a3baa6fc4582ebe39'),
 ('operativo_privado.permite_reprogramacion(oid,jsonb,jsonb)','af7bf8198bf30f9fc9290a7cdd6919b6'),
 ('public.operar_ruta_multiple(jsonb)','3258c2545d0c9dd5960f60bf1d0d103b'),
 ('public.leer_rutas_multiples(date)','45a5aab61e7ade69d307c096531619f5'),
 ('operativo_privado.cantidades_ruta_multi(uuid)','e8c5126070eb08b61684251ac276799c'),
 ('operativo_privado.snapshot_ruta_multi(uuid)','4fc4a59274cd93d5ee774bf903dffdca')
 ) v(firma,huella) loop
 if not exists(select 1 from pg_proc where oid=to_regprocedure(r.firma) and proowner='postgres'::regrole
 and prokind='f' and not proretset
 and prorettype=case when r.firma like '%permite_reprogramacion%' then 'boolean'::regtype else 'jsonb'::regtype end
 and proconfig @> array['search_path=pg_catalog']::text[]
 and md5(replace(prosrc,chr(13)||chr(10),chr(10)))=r.huella) then raise exception 'DEPENDENCIA_CON_CONTRATO_DISTINTO: %',r.firma; end if;
 end loop;
 foreach firma in array array['operativo_privado.historial_operativo','operativo_privado.historial_cargas','operativo_privado.ruta_multi_eventos'] loop
 if not exists(select 1 from pg_trigger where tgrelid=to_regclass(firma) and tgfoid=to_regprocedure('operativo_privado.impedir_mutacion_historial()') and tgtype=27 and tgenabled in ('O','A') and tgqual is null)
 or not exists(select 1 from pg_trigger where tgrelid=to_regclass(firma) and tgfoid=to_regprocedure('operativo_privado.impedir_mutacion_historial()') and tgtype=34 and tgenabled in ('O','A') and tgqual is null) then raise exception 'AUDITORIA_NO_INMUTABLE: %',firma; end if;
 end loop;
end $pre$;
create or replace function public.cerrar_preparacion_autorizada(p_pedido_id uuid,p_version_esperada bigint,p_clave uuid,p_motivo text,p_autoriza_parcial boolean)
returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare v_p public.pedidos%rowtype; v_inicio jsonb; v_s jsonb:='{}'; v_distinto boolean;
begin
 if auth.uid() is null or not coalesce(public.es_admin(),false) then raise exception 'NO_AUTORIZADO'; end if;
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'AISLAMIENTO_NO_COMPATIBLE'; end if;
 v_s:=jsonb_build_object('motivo',p_motivo,'autoriza_parcial',p_autoriza_parcial);
 v_inicio:=operativo_privado.iniciar_operacion(p_pedido_id,p_version_esperada,p_clave,'cerrar_preparacion',v_s);
 if (v_inicio->>'reintento')::boolean then return v_inicio; end if;
 select * into v_p from public.pedidos where id=p_pedido_id for update;
 if not ((v_p.estado='preparando' and v_p.preparacion_finalizada_en is null) or (v_p.estado='listo_despacho' and v_p.preparacion_finalizada_en is not null and coalesce(p_autoriza_parcial,false))) then raise exception 'ESTADO_PEDIDO_INVALIDO'; end if;
 perform 1 from public.items_pedido where pedido_id=p_pedido_id order by id for update;
 perform 1 from public.preparacion_items_pedido where pedido_id=p_pedido_id order by item_pedido_id for update;
 if v_p.fecha_entrega is distinct from (clock_timestamp() at time zone 'America/Santiago')::date then raise exception 'PREPARACION_FECHA_NO_HABILITADA'; end if;
 if not exists(select 1 from public.items_pedido where pedido_id=p_pedido_id) or exists(
 select 1 from public.items_pedido i left join public.preparacion_items_pedido pi on pi.item_pedido_id=i.id
 where i.pedido_id=p_pedido_id and (pi.pedido_id is distinct from i.pedido_id or not coalesce(pi.confirmado_explicito,false) or pi.cantidad_preparada is null or pi.importe_linea_operativo is null or (pi.cantidad_preparada=0 and pi.importe_linea_operativo<>0))) then raise exception 'PRODUCTOS_PENDIENTES'; end if;
 select exists(select 1 from public.items_pedido i join public.preparacion_items_pedido pi on pi.item_pedido_id=i.id where i.pedido_id=p_pedido_id and pi.cantidad_preparada<>i.cantidad) into v_distinto;
 if not exists(select 1 from public.preparacion_items_pedido where pedido_id=p_pedido_id and cantidad_preparada>0) then raise exception 'SIN_PREPARAR'; end if;
 if v_p.estado='listo_despacho' and not v_distinto then raise exception 'ESTADO_PEDIDO_INVALIDO'; end if;
 if v_distinto and (not coalesce(p_autoriza_parcial,false) or nullif(btrim(p_motivo),'') is null or length(p_motivo)>2000) then raise exception 'PARCIAL_NO_AUTORIZADO'; end if;
 update public.pedidos set estado='listo_despacho',preparacion_estado=case when v_distinto then 'incompleta' else 'completa' end,
 preparacion_finalizada_en=clock_timestamp(),preparacion_finalizada_por=auth.uid() where id=p_pedido_id;
 return operativo_privado.completar_operacion(p_pedido_id,p_version_esperada,p_clave,'cerrar_preparacion',v_s,null,case when v_distinto then 'Preparación parcial autorizada: '||left(btrim(p_motivo),1900) else 'Cierre explícito de preparación' end,
 jsonb_build_object('estado',v_p.estado,'importe_operativo',v_p.total_operativo_preparacion),
 jsonb_build_object('estado','listo_despacho','importe_operativo',v_p.total_operativo_preparacion,'parcial_autorizado',v_distinto,'motivo',p_motivo,'cantidades',operativo_privado.cantidades_ruta_multi(p_pedido_id)),jsonb_build_object('finalizado',true));
end; $$;


-- Mantener firma antigua para clientes de preparación completa; ningún cliente
-- antiguo puede finalizar un parcial sin la nueva autorización administrativa.
create or replace function public.cerrar_preparacion_explicita(p_pedido_id uuid,p_version_esperada bigint,p_clave uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
begin
 if auth.uid() is null or not coalesce(public.es_admin(),false) then raise exception 'NO_AUTORIZADO'; end if;
 -- Respuestas de cierres anteriores al despliegue conservan su payload original.
 if exists(select 1 from operativo_privado.historial_operativo where pedido_id=p_pedido_id and clave_idempotencia=p_clave and operacion='cerrar_preparacion' and solicitud='{}'::jsonb) then
 return operativo_privado.iniciar_operacion(p_pedido_id,p_version_esperada,p_clave,'cerrar_preparacion','{}'::jsonb);
 end if;
 return public.cerrar_preparacion_autorizada(p_pedido_id,p_version_esperada,p_clave,null,false);
end $$;

create or replace function public.resolver_pedido_sin_stock(
 p_pedido_id uuid,p_version_esperada bigint,p_clave uuid,p_motivo text,p_confirmado boolean
) returns jsonb language plpgsql security definer set search_path=pg_catalog set timezone='UTC' set datestyle='ISO, YMD' as $$
declare p public.pedidos%rowtype; inicio jsonb; solicitud jsonb; evento jsonb; respuesta jsonb;
 rid uuid; ruta operativo_privado.rutas_multi%rowtype; carga operativo_privado.cargas%rowtype;
 antes jsonb; despues jsonb; paradas jsonb; fecha_carga date;
begin
 if auth.uid() is null or not coalesce(public.es_admin(),false) then raise exception 'NO_AUTORIZADO'; end if;
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'AISLAMIENTO_NO_COMPATIBLE'; end if;
 -- Mismo bloqueo que salida/asignación; NOWAIT evita invertir locks contables.
 lock table public.pedidos in exclusive mode nowait;
 perform pg_advisory_xact_lock(582051005);
 solicitud:=jsonb_build_object('motivo',p_motivo,'confirmado',p_confirmado,'origen','sin_stock_pre_despacho');
 inicio:=operativo_privado.iniciar_operacion(p_pedido_id,p_version_esperada,p_clave,'entrega_fallida',solicitud);
 if (inicio->>'reintento')::boolean then return inicio; end if;
 select * into p from public.pedidos where id=p_pedido_id for update;
 if not coalesce(p_confirmado,false) or nullif(btrim(p_motivo),'') is null or length(p_motivo)>2000 then raise exception 'SIN_STOCK_NO_CONFIRMADO'; end if;
 if p.regimen_contable is distinct from 'entrega_v1' then raise exception 'REGIMEN_CONTABLE_NO_COMPATIBLE'; end if;
 if p.fecha_entrega is distinct from (clock_timestamp() at time zone 'America/Santiago')::date then raise exception 'PREPARACION_FECHA_NO_HABILITADA'; end if;
 if p.estado not in ('preparando','listo_despacho') or p.venta_definitiva_snapshot is not null or p.venta_reconocida_en is not null
 or exists(select 1 from operativo_privado.entregas_definitivas where pedido_id=p.id) then raise exception 'ESTADO_PEDIDO_INVALIDO'; end if;
 if exists(select 1 from public.aplicaciones_pago where pedido_id=p.id and activa)
 or exists(select 1 from operativo_privado.cobros_entrega where pedido_id=p.id)
 or exists(select 1 from operativo_privado.pagos_entrega where pedido_id=p.id)
 or exists(select 1 from public.correcciones_venta_entregada where pedido_id=p.id) then
 raise exception 'SIN_STOCK_HISTORICO_INCOMPATIBLE'; end if;
 perform 1 from public.items_pedido where pedido_id=p.id order by id for update;
 perform 1 from public.preparacion_items_pedido where pedido_id=p.id order by item_pedido_id for update;
 if not exists(select 1 from public.items_pedido where pedido_id=p.id) or exists(
 select 1 from public.items_pedido i left join public.preparacion_items_pedido pi on pi.item_pedido_id=i.id
 where i.pedido_id=p.id and (pi.pedido_id is distinct from i.pedido_id or not coalesce(pi.confirmado_explicito,false) or pi.cantidad_preparada is distinct from 0::numeric or pi.importe_linea_operativo is distinct from 0::bigint)) then raise exception 'SIN_STOCK_NO_CONFIRMADO'; end if;
 select m.ruta_id into rid from operativo_privado.ruta_multi_pedidos m where m.pedido_id=p.id;
 if rid is not null and exists(select 1 from operativo_privado.cargas where fecha=p.fecha_entrega) then raise exception 'REFERENCIAS_OPERATIVAS_INCOMPATIBLES'; end if;
 if rid is not null then
 select * into ruta from operativo_privado.rutas_multi where id=rid for update;
 if ruta.estado<>'preparacion' then raise exception 'RUTA_NO_EDITABLE'; end if;
 antes:=operativo_privado.snapshot_ruta_multi(rid);
 end if;
 -- No crear una jornada legacy por resolver un pedido sin asignación:
 -- eso impediría crear rutas múltiples para los demás pedidos de la fecha.
 select cp.fecha into fecha_carga from operativo_privado.carga_pedidos cp where cp.pedido_id=p.id;
 if rid is not null and fecha_carga is not null then raise exception 'REFERENCIAS_OPERATIVAS_INCOMPATIBLES'; end if;
 if fecha_carga is not null and fecha_carga is distinct from p.fecha_entrega then raise exception 'SIN_STOCK_HISTORICO_INCOMPATIBLE'; end if;
 if fecha_carga is null and rid is null and exists(select 1 from operativo_privado.cargas where fecha=p.fecha_entrega) then fecha_carga:=p.fecha_entrega; end if;
 if fecha_carga is not null then
 perform pg_advisory_xact_lock(hashtextextended('carga:'||fecha_carga::text,0));
 select * into carga from operativo_privado.cargas where fecha=fecha_carga for update;
 if carga.estado is distinct from 'preparacion' or carga.salida_en is not null then raise exception 'CARGA_CONFIRMADA'; end if;
 despues:=public.leer_carga_jornada(carga.fecha)-'historial';
 insert into operativo_privado.carga_pedidos(fecha,pedido_id,incluido,motivo)
 values(carga.fecha,p.id,false,'No entregado — Sin stock: '||left(btrim(p_motivo),1900))
 on conflict(pedido_id) do update set incluido=false,motivo=excluded.motivo
 where operativo_privado.carga_pedidos.fecha=excluded.fecha;
 if not found then raise exception 'REFERENCIAS_OPERATIVAS_INCOMPATIBLES'; end if;
 end if;
 -- No modificar paradas históricas ni con evidencia de desplazamiento físico.
 perform 1 from public.paradas_ruta where pedido_id=p.id order by id for update;
 if exists(select 1 from public.paradas_ruta pr join public.rutas r on r.id=pr.ruta_id
 where pr.pedido_id=p.id and (r.fecha_operativa is distinct from p.fecha_entrega
 or r.estado_logistico not in ('borrador','planificada')
 or pr.estado_logistico not in ('sin_ordenar','planificada','cancelada')
 or pr.hora_inicio is not null or pr.hora_entrega is not null
 or exists(select 1 from operativo_privado.rutas_multi where id=pr.ruta_id)
 or exists(select 1 from operativo_privado.cargas where fecha=r.fecha_operativa and estado<>'preparacion'))) then
 raise exception 'SIN_STOCK_HISTORICO_INCOMPATIBLE'; end if;
 -- Una pertenencia multi junto a paradas legacy es una contradicción: no adivinar.
 if rid is not null and exists(select 1 from public.paradas_ruta where pedido_id=p.id) then raise exception 'REFERENCIAS_OPERATIVAS_INCOMPATIBLES'; end if;
 select coalesce(jsonb_agg(to_jsonb(pr) order by pr.id),'[]'::jsonb) into paradas from public.paradas_ruta pr where pedido_id=p.id;
 if p.fecha_entrega is distinct from (clock_timestamp() at time zone 'America/Santiago')::date then raise exception 'PREPARACION_FECHA_NO_HABILITADA'; end if;
 evento:=jsonb_build_object('estado','entrega_fallida','fecha',clock_timestamp(),'actor_id',auth.uid(),'motivo','Sin stock','observaciones',btrim(p_motivo),'origen','sin_stock_pre_despacho','regimen_contable',p.regimen_contable,'ruta_retirada',rid,'carga_excluida',fecha_carga,'paradas_retiradas',paradas);
 respuesta:=operativo_privado.completar_operacion(p.id,p_version_esperada,p_clave,'entrega_fallida',solicitud,null,'Sin stock: '||left(btrim(p_motivo),1900),
 jsonb_build_object('estado',p.estado,'regimen_contable',p.regimen_contable),evento,
 evento||jsonb_build_object('pedido_id',p.id,'venta_registrada',false,'deuda_registrada',false,'pagos_registrados',false));
 update public.pedidos set estado='entrega_fallida' where id=p.id;
 -- Retirar sólo referencias de planificación, ya capturadas en auditoría.
 -- Consumir versión pública invalida borradores del orden anterior.
 update public.rutas set version=version+1 where id in (select ruta_id from public.paradas_ruta where pedido_id=p.id);
 delete from public.paradas_ruta where pedido_id=p.id;
 if rid is not null then
 delete from operativo_privado.ruta_multi_autorizaciones where pedido_id=p.id;
 delete from operativo_privado.ruta_multi_pedidos where pedido_id=p.id;
 update operativo_privado.rutas_multi set version=version+1 where id=rid;
 insert into operativo_privado.ruta_multi_eventos(clave,ruta_id,actor,solicitud,anterior,resultado)
 values(p_clave,rid,auth.uid(),solicitud||jsonb_build_object('accion','resolver_sin_stock','pedido',p.id),antes,
 jsonb_build_object('ok',true,'version',ruta.version+1,'snapshot',operativo_privado.snapshot_ruta_multi(rid)));
 end if;
 if carga.fecha is not null then
 update operativo_privado.cargas set version=version+1 where fecha=carga.fecha;
 insert into operativo_privado.historial_cargas(fecha,version,clave,actor,solicitud,anterior,resultado)
 values(carga.fecha,carga.version+1,p_clave,auth.uid(),solicitud||jsonb_build_object('accion','resolver_sin_stock','pedido',p.id),despues,public.leer_carga_jornada(carga.fecha)-'historial');
 end if;
 return respuesta;
end $$;


-- Barrera completa; conserva la reprogramación y el fallo durante reparto.
create or replace function operativo_privado.proteger_entrega_fallida()
returns trigger language plpgsql security definer set search_path=pg_catalog set timezone='UTC' set datestyle='ISO, YMD' as $$
begin
  if TG_OP='UPDATE' and new.estado='en_reparto' and old.estado is distinct from new.estado then
    if old.estado<>'listo_despacho' or new.preparacion_finalizada_en is null then raise exception 'PEDIDO_NO_LISTO'; end if;
    if not exists(select 1 from public.items_pedido where pedido_id=new.id)
    or not exists(select 1 from public.preparacion_items_pedido where pedido_id=new.id and cantidad_preparada>0) then raise exception 'SIN_PREPARAR'; end if;
    if exists(select 1 from public.items_pedido i left join public.preparacion_items_pedido pi on pi.item_pedido_id=i.id
      where i.pedido_id=new.id and (pi.pedido_id is distinct from i.pedido_id or not coalesce(pi.confirmado_explicito,false) or pi.cantidad_preparada is null or pi.importe_linea_operativo is null or (pi.cantidad_preparada=0 and pi.importe_linea_operativo<>0))) then raise exception 'PRODUCTOS_PENDIENTES'; end if;
    if exists(select 1 from public.items_pedido i join public.preparacion_items_pedido pi on pi.item_pedido_id=i.id
      where i.pedido_id=new.id and pi.cantidad_preparada<>i.cantidad)
    and not exists(select 1 from operativo_privado.historial_operativo h
      where h.pedido_id=new.id and h.operacion='cerrar_preparacion'
      and h.valores_nuevos->>'parcial_autorizado'='true'
      and h.valores_nuevos->'cantidades'=operativo_privado.cantidades_ruta_multi(new.id)
      and not exists(select 1 from operativo_privado.historial_operativo posterior where posterior.pedido_id=h.pedido_id
        and posterior.version>h.version and posterior.operacion in ('preparar_producto','cerrar_preparacion','carga_reabrir'))) then raise exception 'PARCIAL_NO_AUTORIZADO'; end if;
  end if;
  if TG_OP = 'UPDATE' then
    if operativo_privado.permite_reprogramacion(TG_RELID,to_jsonb(old),to_jsonb(new)) then return new; end if;
    if old.estado = 'entrega_fallida' and new.estado is distinct from old.estado
      and exists (select 1 from operativo_privado.historial_operativo
        where pedido_id = old.id and operacion = 'entrega_fallida') then
      raise exception 'ENTREGA_FALLIDA_SIN_REPROGRAMACION';
    end if;
    if new.estado is not distinct from old.estado then return new; end if;
  end if;
  if new.estado = 'entrega_fallida' then
    if TG_OP = 'INSERT' then raise exception 'ENTREGA_FALLIDA_REQUIERE_OPERACION'; end if;
    if old.estado in ('preparando','listo_despacho') and new.regimen_contable='entrega_v1'
      and new.venta_definitiva_snapshot is null and new.venta_reconocida_en is null
      and auth.uid() is not null and coalesce(public.es_admin(),false)
      and exists(select 1 from operativo_privado.historial_operativo h
        join operativo_privado.versiones_pedido v on v.pedido_id=h.pedido_id and v.version=h.version
        where h.pedido_id=new.id and h.operacion='entrega_fallida' and h.actor_id=auth.uid()
        and h.valores_anteriores->>'estado'=old.estado::text
        and h.valores_nuevos->>'estado'='entrega_fallida'
        and h.valores_nuevos->>'origen'='sin_stock_pre_despacho'
        and h.valores_nuevos->>'motivo'='Sin stock' and h.solicitud->>'confirmado'='true')
      and not exists(select 1 from operativo_privado.entregas_definitivas where pedido_id=new.id)
      and not exists(select 1 from public.aplicaciones_pago where pedido_id=new.id and activa)
      and exists(select 1 from public.items_pedido where pedido_id=new.id)
      and not exists(select 1 from public.items_pedido i left join public.preparacion_items_pedido pi on pi.item_pedido_id=i.id
        where i.pedido_id=new.id and (pi.pedido_id is distinct from i.pedido_id or not coalesce(pi.confirmado_explicito,false) or pi.cantidad_preparada is distinct from 0::numeric or pi.importe_linea_operativo is distinct from 0::bigint))
      then return new; end if;
    if old.estado <> 'en_reparto'
      or new.venta_definitiva_snapshot is not null or new.venta_reconocida_en is not null
      or not exists (
        select 1 from operativo_privado.historial_operativo h
        join operativo_privado.versiones_pedido v
          on v.pedido_id = h.pedido_id and v.version = h.version
        where h.pedido_id = new.id and h.operacion = 'entrega_fallida'
          and h.actor_id = auth.uid()
          and h.valores_anteriores->>'estado' = 'en_reparto'
          and h.valores_nuevos->>'estado' = 'entrega_fallida'
      ) then raise exception 'ENTREGA_FALLIDA_REQUIERE_OPERACION'; end if;
  end if;
  return new;
end;
$$;

create or replace function public.leer_mi_reparto() returns jsonb
language sql stable security definer set search_path=pg_catalog set timezone='UTC' set datestyle='ISO, YMD' as $$
 select case when public.acceso_repartidor() then operativo_privado.leer_mi_reparto() || coalesce((
 select jsonb_agg(jsonb_build_object('ruta',r.id,'nombre',r.nombre,'fecha',r.fecha,'asignacion',r.version,'estado','en_ruta',
 'pedidos',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'numero',p.numero_pedido,'cliente',p.nombre_cliente_snapshot,
 'direccion',concat_ws(', ',p.direccion_snapshot,p.comuna_snapshot,p.region_snapshot),'telefono',p.telefono_cliente_snapshot,'referencia',p.referencia_direccion_snapshot,
 'estado',p.estado,'preparacion',operativo_privado.estado_preparacion_multi(p.id),'version',coalesce(v.version,0),'posicion',m.posicion,
 'productos',coalesce((select jsonb_agg(jsonb_build_object('nombre',i.nombre_producto_snapshot,'cantidad',pi.cantidad_preparada,'enviada',pi.cantidad_preparada,'importe_operativo',pi.importe_linea_operativo,'solicitada',i.cantidad,'faltante',greatest(i.cantidad-pi.cantidad_preparada,0),'unidad',i.unidad_snapshot) order by i.id)
 from public.items_pedido i join public.preparacion_items_pedido pi on pi.item_pedido_id=i.id where i.pedido_id=p.id),'[]'::jsonb)) order by m.posicion,p.id)
 from operativo_privado.ruta_multi_pedidos m join public.pedidos p on p.id=m.pedido_id left join operativo_privado.versiones_pedido v on v.pedido_id=p.id where m.ruta_id=r.id),'[]'::jsonb)) order by r.fecha,r.nombre,r.id)
 from operativo_privado.rutas_multi r join operativo_privado.ruta_multi_repartidores a on a.ruta_id=r.id
 join operativo_privado.repartidores rp on rp.usuario_id=a.usuario_id and rp.activo
 where a.usuario_id=auth.uid() and r.estado='en_reparto'),'[]'::jsonb) else '[]'::jsonb end;
$$;

create or replace function operativo_privado.leer_mi_reparto() returns jsonb language sql stable security definer set search_path=pg_catalog set timezone='UTC' set datestyle='ISO, YMD' as $$
 select coalesce(jsonb_agg(jsonb_build_object('fecha',a.fecha,'asignacion',a.version,'estado',c.estado,
 'pedidos',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'numero',p.numero_pedido,'cliente',p.nombre_cliente_snapshot,
 'direccion',concat_ws(', ',p.direccion_snapshot,p.comuna_snapshot,p.region_snapshot),'telefono',p.telefono_cliente_snapshot,'referencia',p.referencia_direccion_snapshot,
 'estado',p.estado,'version',coalesce(v.version,0),'posicion',pr.posicion,
 'productos',coalesce((select jsonb_agg(jsonb_build_object('nombre',i.nombre_producto_snapshot,'cantidad',pi.cantidad_preparada,'solicitada',i.cantidad,'enviada',pi.cantidad_preparada,'importe_operativo',pi.importe_linea_operativo,'unidad',i.unidad_snapshot) order by i.id)
 from public.items_pedido i join public.preparacion_items_pedido pi on pi.item_pedido_id=i.id where i.pedido_id=p.id),'[]'::jsonb)) order by pr.posicion nulls last,p.numero_pedido)
 from operativo_privado.carga_pedidos cp join public.pedidos p on p.id=cp.pedido_id and p.fecha_entrega=a.fecha
 left join operativo_privado.versiones_pedido v on v.pedido_id=p.id
 left join public.paradas_ruta pr on pr.ruta_id=a.ruta_id and pr.pedido_id=p.id
 where cp.fecha=a.fecha and cp.incluido),'[]'::jsonb)) order by a.fecha),'[]'::jsonb)
 from operativo_privado.reparto_asignaciones a join operativo_privado.cargas c on c.fecha=a.fecha
 where public.acceso_repartidor() and a.usuario_id=auth.uid() and c.estado='en_ruta'
 and exists(select 1 from public.rutas r where r.id=a.ruta_id and r.es_principal and r.fecha_operativa=a.fecha);
$$;

create or replace function operativo_privado.estado_preparacion_multi(p_pedido uuid) returns text
language sql stable security definer set search_path=pg_catalog as $$
 select case when count(*)=0 or coalesce(bool_and(coalesce(pi.cantidad_preparada,0)=0),true) then 'sin_preparar'
 when bool_and(coalesce(pi.cantidad_preparada,0)=i.cantidad) then 'listo' else 'parcial' end
 from public.items_pedido i left join public.preparacion_items_pedido pi on pi.item_pedido_id=i.id where i.pedido_id=p_pedido;
$$;

create or replace function public.leer_preparacion_explicita(p_pedido_id uuid)
returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
begin
 if auth.uid() is null or not coalesce(public.es_admin(),false) then raise exception 'NO_AUTORIZADO'; end if;
 return jsonb_build_object('importe_operativo',(select importe_operativo from public.pedidos where id=p_pedido_id),'version',coalesce((select version from operativo_privado.versiones_pedido where pedido_id=p_pedido_id),0),
 'historial',coalesce((select jsonb_agg(to_jsonb(h) - 'solicitud' - 'resultado' order by h.version desc) from operativo_privado.historial_operativo h where h.pedido_id=p_pedido_id and (h.operacion in ('preparar_producto','cerrar_preparacion') or (h.operacion='entrega_fallida' and h.valores_nuevos->>'origen'='sin_stock_pre_despacho'))),'[]'::jsonb));
end; $$;

alter function operativo_privado.proteger_entrega_fallida() owner to postgres;
revoke all on function operativo_privado.proteger_entrega_fallida() from public,anon,authenticated,service_role;
alter function public.leer_mi_reparto() owner to postgres;
revoke all on function public.leer_mi_reparto() from public,anon,authenticated,service_role;
grant execute on function public.leer_mi_reparto() to authenticated;
alter function operativo_privado.leer_mi_reparto() owner to postgres;
revoke all on function operativo_privado.leer_mi_reparto() from public,anon,authenticated,service_role;
alter function operativo_privado.estado_preparacion_multi(uuid) owner to postgres;
revoke all on function operativo_privado.estado_preparacion_multi(uuid) from public,anon,authenticated,service_role;
alter function public.leer_preparacion_explicita(uuid) owner to postgres;
revoke all on function public.leer_preparacion_explicita(uuid) from public,anon,authenticated,service_role;
grant execute on function public.leer_preparacion_explicita(uuid) to authenticated;
alter function public.cerrar_preparacion_explicita(uuid,bigint,uuid) owner to postgres;
revoke all on function public.cerrar_preparacion_explicita(uuid,bigint,uuid) from public,anon,authenticated,service_role;
grant execute on function public.cerrar_preparacion_explicita(uuid,bigint,uuid) to authenticated;
alter function public.cerrar_preparacion_autorizada(uuid,bigint,uuid,text,boolean) owner to postgres;
revoke all on function public.cerrar_preparacion_autorizada(uuid,bigint,uuid,text,boolean) from public,anon,authenticated,service_role;
grant execute on function public.cerrar_preparacion_autorizada(uuid,bigint,uuid,text,boolean) to authenticated;
alter function public.resolver_pedido_sin_stock(uuid,bigint,uuid,text,boolean) owner to postgres;
revoke all on function public.resolver_pedido_sin_stock(uuid,bigint,uuid,text,boolean) from public,anon,authenticated,service_role;
grant execute on function public.resolver_pedido_sin_stock(uuid,bigint,uuid,text,boolean) to authenticated;

create or replace function public.confirmar_producto_preparado(
 p_item_pedido_id uuid, p_cantidad numeric, p_importe bigint,
 p_version_esperada bigint, p_clave uuid, p_motivo text
) returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare
 v_id uuid; v_p public.pedidos%rowtype; v_i public.items_pedido%rowtype;
 v_anterior jsonb; v_nuevo jsonb; v_solicitud jsonb; v_inicio jsonb; v_modo text; v_importe bigint; v_total bigint;
begin
 if auth.uid() is null or not coalesce(public.es_admin(),false) then raise exception 'NO_AUTORIZADO'; end if;
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'AISLAMIENTO_NO_COMPATIBLE'; end if;
 select pedido_id into v_id from public.items_pedido where id=p_item_pedido_id;
 if not found then raise exception 'ITEM_PEDIDO_NO_ENCONTRADO'; end if;
 v_solicitud:=jsonb_build_object('item',p_item_pedido_id,'cantidad',p_cantidad,'importe',p_importe,'motivo',p_motivo);
 v_inicio:=operativo_privado.iniciar_operacion(v_id,p_version_esperada,p_clave,'preparar_producto',v_solicitud);
 if (v_inicio->>'reintento')::boolean then return v_inicio; end if;
 select * into v_p from public.pedidos where id=v_id for update;
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
 if p_cantidad=0 and p_importe is distinct from 0::bigint then raise exception 'SIN_STOCK_IMPORTE_NO_CERO'; end if;
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
 -- Agregado provisional: una falta de stock no genera un importe negativo.
 select greatest(0,sum(case when pi.confirmado_explicito then pi.importe_linea_operativo else i.total_linea end)+v_p.costo_entrega-v_p.descuento)
 into v_total from public.items_pedido i left join public.preparacion_items_pedido pi on pi.item_pedido_id=i.id where i.pedido_id=v_id;
 if v_total<0 or v_total>9007199254740991 then raise exception 'TOTAL_FINAL_INVALIDO'; end if;
 update public.pedidos set total_operativo_preparacion=v_total,preparacion_estado='pendiente' where id=v_id;
 return operativo_privado.completar_operacion(v_id,p_version_esperada,p_clave,'preparar_producto',v_solicitud,v_i.id,p_motivo,v_anterior,v_nuevo,jsonb_build_object('guardado',true,'importe_operativo',v_total));
end; $$;

alter function public.confirmar_producto_preparado(uuid,numeric,bigint,bigint,uuid,text) owner to postgres;
revoke all on function public.confirmar_producto_preparado(uuid,numeric,bigint,bigint,uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.confirmar_producto_preparado(uuid,numeric,bigint,bigint,uuid,text) to authenticated;

create or replace function public.guardar_avance_producto_preparado(
 p_item_pedido_id uuid, p_cantidad numeric,
 p_version_esperada bigint, p_clave uuid
) returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare
 v_id uuid; v_p public.pedidos%rowtype; v_i public.items_pedido%rowtype;
 v_anterior jsonb; v_nuevo jsonb; v_solicitud jsonb; v_inicio jsonb; v_modo text; v_total bigint;
begin
 if auth.uid() is null or not coalesce(public.es_admin(),false) then raise exception 'NO_AUTORIZADO'; end if;
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'AISLAMIENTO_NO_COMPATIBLE'; end if;
 select pedido_id into v_id from public.items_pedido where id=p_item_pedido_id;
 if not found then raise exception 'ITEM_PEDIDO_NO_ENCONTRADO'; end if;
 v_solicitud:=jsonb_build_object('item',p_item_pedido_id,'cantidad',p_cantidad,'tipo','avance_parcial');
 v_inicio:=operativo_privado.iniciar_operacion(v_id,p_version_esperada,p_clave,'preparar_producto',v_solicitud);
 if (v_inicio->>'reintento')::boolean then return v_inicio; end if;
 select * into v_p from public.pedidos where id=v_id for update;
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
 -- Agregado provisional: una falta de stock no genera un importe negativo.
 select greatest(0,sum(case when pi.confirmado_explicito then pi.importe_linea_operativo else i.total_linea end)+v_p.costo_entrega-v_p.descuento)
 into v_total from public.items_pedido i left join public.preparacion_items_pedido pi on pi.item_pedido_id=i.id where i.pedido_id=v_id;
 if v_total<0 or v_total>9007199254740991 then raise exception 'TOTAL_FINAL_INVALIDO'; end if;
 update public.pedidos set total_operativo_preparacion=v_total,preparacion_estado='pendiente' where id=v_id;
 return operativo_privado.completar_operacion(v_id,p_version_esperada,p_clave,'preparar_producto',v_solicitud,v_i.id,'Guardado parcial de cantidad cargada; pendiente de confirmación definitiva',v_anterior,v_nuevo,jsonb_build_object('guardado',true,'confirmado_explicito',false,'cantidad_preparada',p_cantidad,'importe_operativo',v_total));
end; $$;

alter function public.guardar_avance_producto_preparado(uuid,numeric,bigint,uuid) owner to postgres;
revoke all on function public.guardar_avance_producto_preparado(uuid,numeric,bigint,uuid) from public,anon,authenticated,service_role;
grant execute on function public.guardar_avance_producto_preparado(uuid,numeric,bigint,uuid) to authenticated;

create or replace function public.leer_carga_jornada(p_fecha date)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog set timezone='UTC' set datestyle='ISO, YMD' as $$
declare c operativo_privado.cargas%rowtype;
begin
 if auth.uid() is null or not coalesce((public.es_admin() or operativo_privado.permiso_reparto(null,p_fecha)),false) then raise exception 'NO_AUTORIZADO'; end if;
 if p_fecha is null or not isfinite(p_fecha) then raise exception 'OPERACION_INVALIDA'; end if;
 -- STABLE mantiene el mismo snapshot entre esta decisión y las consultas de
 -- lectura: un cierre/reprogramación concurrente no mezcla ambas jornadas.
 select * into c from operativo_privado.cargas where fecha=p_fecha;
 -- Una jornada cerrada se lee desde su evidencia inmutable, nunca desde la
 -- asignación actual del pedido (que puede pertenecer a un intento posterior).
 if c.estado='cerrada' then
 return jsonb_build_object('estado',c.estado,'salida_en',c.salida_en,'version',c.version,
 'pedidos',c.resumen_cierre->'pedidos_carga',
 'historial',coalesce((select jsonb_agg(to_jsonb(h) order by h.version desc)
 from operativo_privado.historial_cargas h where h.fecha=p_fecha),'[]'::jsonb));
 end if;
 return jsonb_build_object(
 'estado',coalesce((select estado from operativo_privado.cargas where fecha=p_fecha),'preparacion'),
 'salida_en',(select salida_en from operativo_privado.cargas where fecha=p_fecha),
 'version',coalesce((select version from operativo_privado.cargas where fecha=p_fecha),0),
 'pedidos',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'numero',p.numero_pedido,'cliente',p.nombre_cliente_snapshot,
 'estado',p.estado,'incluido',case when cp.pedido_id is null and p.estado='entrega_fallida' and exists(select 1 from operativo_privado.historial_operativo h where h.pedido_id=p.id and h.operacion='entrega_fallida' and h.valores_nuevos->>'origen'='sin_stock_pre_despacho') then false else cp.incluido end,
 'motivo',coalesce(cp.motivo,(select h.motivo from operativo_privado.historial_operativo h where h.pedido_id=p.id and h.operacion='entrega_fallida' and h.valores_nuevos->>'origen'='sin_stock_pre_despacho' order by h.version desc limit 1)),
 'productos',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'nombre',i.nombre_producto_snapshot,
 'cantidad',pi.cantidad_preparada,'solicitada',i.cantidad,'enviada',case when cp.incluido and c.salida_en is not null then pi.cantidad_preparada else 0 end,'importe',pi.importe_linea_operativo,'confirmado',coalesce(pi.confirmado_explicito,false)) order by i.id)
 from public.items_pedido i left join public.preparacion_items_pedido pi on pi.item_pedido_id=i.id where i.pedido_id=p.id),'[]'::jsonb),'pendientes',
 (select count(*) from public.items_pedido i left join public.preparacion_items_pedido pi on pi.item_pedido_id=i.id
 where i.pedido_id=p.id and (not coalesce(pi.confirmado_explicito,false) or pi.importe_linea_operativo is null))) order by p.numero_pedido)
 from public.pedidos p left join operativo_privado.carga_pedidos cp on cp.pedido_id=p.id and cp.fecha=p_fecha
 where p.fecha_entrega=p_fecha or cp.fecha=p_fecha),'[]'::jsonb),
 'historial',coalesce((select jsonb_agg(to_jsonb(h) order by h.version desc) from operativo_privado.historial_cargas h where h.fecha=p_fecha),'[]'::jsonb));
end; $$;

alter function public.leer_carga_jornada(date) owner to postgres;
revoke all on function public.leer_carga_jornada(date) from public,anon,authenticated,service_role;
grant execute on function public.leer_carga_jornada(date) to authenticated;

-- Verificación final de instalación: catálogo y ACL; no ejecuta operaciones.
do $verificacion$
declare r record; rol text;
begin
 for r in select * from (values
 ('public.cerrar_preparacion_autorizada(uuid,bigint,uuid,text,boolean)','f80b8eeb19134ff07125478a62a7c36d'),
 ('public.cerrar_preparacion_explicita(uuid,bigint,uuid)','726d98b063f453197206c903af1ff292'),
 ('public.resolver_pedido_sin_stock(uuid,bigint,uuid,text,boolean)','c0dd876a5207b727a6563c3c73d8656b'),
 ('operativo_privado.proteger_entrega_fallida()','a80be58925ab40f7440b9d1c4a9658a7'),
 ('public.leer_mi_reparto()','b65f390394759435c7a99e4dbcd8b748'),
 ('operativo_privado.leer_mi_reparto()','350ce5659a5362aadbf1ebe3ecd65aa8'),
 ('operativo_privado.estado_preparacion_multi(uuid)','8739840a9f181dda697cbd5f9c0c9e73'),
 ('public.leer_preparacion_explicita(uuid)','f528943f4bfabe84eaa93139dc02d233'),
 ('public.confirmar_producto_preparado(uuid,numeric,bigint,bigint,uuid,text)','1485e60ba5c827ec56f653f393ec4f16'),
 ('public.guardar_avance_producto_preparado(uuid,numeric,bigint,uuid)','be5338c4deeafd5f00ae86bfa2e21b8d'),
 ('public.leer_carga_jornada(date)','3ae5b4b136022b8f67729a4144b3cc22')
 ) v(firma,huella) loop
 if not exists(select 1 from pg_proc where oid=to_regprocedure(r.firma) and proowner='postgres'::regrole
 and md5(replace(prosrc,chr(13)||chr(10),chr(10)))=r.huella) then raise exception 'INSTALACION_INCOMPLETA: %',r.firma; end if;
 if exists(select 1 from pg_proc p,lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
 where p.oid=to_regprocedure(r.firma) and (a.grantee not in ('postgres'::regrole::oid,case when r.firma like 'public.%' then 'authenticated'::regrole::oid else 'postgres'::regrole::oid end)
 or a.grantor<>'postgres'::regrole::oid or (a.grantee<>'postgres'::regrole::oid and a.is_grantable))) then raise exception 'ACL_INSTALADA_INCOMPATIBLE: %',r.firma; end if;
 foreach rol in array array['anon','authenticated','service_role'] loop
 if has_function_privilege(rol,to_regprocedure(r.firma),'EXECUTE') is distinct from (rol='authenticated' and r.firma like 'public.%') then raise exception 'PERMISO_INSTALADO_INCOMPATIBLE: % (%)',r.firma,rol; end if;
 end loop;
 end loop;
 raise notice 'Preparación autorizada y resolución sin stock instaladas. Sin backfill ni operaciones contables.';
end $verificacion$;
notify pgrst,'reload schema';
commit;
