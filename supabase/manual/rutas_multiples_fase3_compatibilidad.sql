-- Fase 3: incremental corregido; sustituye a rutas_multiples_fase3.sql.
-- Instalación manual única sobre Fase 2, nunca ejecutar desde el agente.
-- Sólo se corrigen/endurecen precondiciones; el payload de Fase 3 es idéntico.
-- ATENCIÓN: instalar Fase 3 reemplaza las tres RPC, como el incremental original.
-- No ejecutar si se requiere conservar las definiciones instaladas de Fase 2.
-- CRLF -> LF se aplica exclusivamente al comparar prosrc, nunca al catálogo.
-- No se eliminan CR aislados, espacios, comentarios ni saltos iniciales/finales.
-- No modifica cargas históricas, importes, pagos ni contratos contables.
begin;
set local lock_timeout='5s';
do $pre$ declare firma text; rol text; begin
 if current_user<>'postgres' or not exists(select 1 from pg_roles where rolname=current_user and (rolsuper or rolbypassrls)) then raise exception 'REQUIERE_POSTGRES_BYPASSRLS'; end if;
 if to_regclass('operativo_privado.rutas_multi') is null then raise exception 'REQUIERE_FASE_2'; end if;
 if not exists(select 1 from pg_proc where oid=to_regprocedure('public.operar_ruta_multiple(jsonb)') and proowner='postgres'::regrole and md5(replace(prosrc, chr(13)||chr(10), chr(10)))='3e7bedaabab7ed3dd7058cafa3fb1f21') then raise exception 'CONTRATO_FASE_2_INCOMPATIBLE: public.operar_ruta_multiple'; end if;
 if not exists(select 1 from pg_proc where oid=to_regprocedure('public.leer_rutas_multiples(date)') and proowner='postgres'::regrole and md5(replace(prosrc, chr(13)||chr(10), chr(10)))='5438a8139ed3f3845e618380ce2b6794') then raise exception 'CONTRATO_FASE_2_INCOMPATIBLE: public.leer_rutas_multiples'; end if;
 if not exists(select 1 from pg_proc where oid=to_regprocedure('public.leer_mi_reparto()') and proowner='postgres'::regrole and md5(replace(prosrc, chr(13)||chr(10), chr(10)))='bbeb502fd8085565c72e0f71f6f5b588') then raise exception 'CONTRATO_FASE_2_INCOMPATIBLE: public.leer_mi_reparto'; end if;
 -- El hash de prosrc no cubre firma de retorno, atributos ni ACL.
 -- Contratos declarados en rutas_multiples_fase2.sql; no se reparan permisos.
 foreach firma in array array['public.operar_ruta_multiple(jsonb)',
 'public.leer_rutas_multiples(date)', 'public.leer_mi_reparto()'] loop
 if not exists(
 select 1 from pg_catalog.pg_proc p
 join pg_catalog.pg_language l on l.oid=p.prolang
 where p.oid=pg_catalog.to_regprocedure(firma)
 and p.prokind='f' and p.prorettype='jsonb'::regtype and not p.proretset
 and p.prosecdef and not p.proisstrict and not p.proleakproof
 and p.proparallel='u' and p.pronargdefaults=0
 and p.proargmodes is null and p.proallargtypes is null
 and p.proargnames is not distinct from case firma
   when 'public.operar_ruta_multiple(jsonb)' then array['p_solicitud']::text[]
   when 'public.leer_rutas_multiples(date)' then array['p_fecha']::text[]
   else null::text[] end
 and l.lanname=case when firma='public.leer_mi_reparto()' then 'sql' else 'plpgsql' end
 and p.provolatile::text=case when firma='public.operar_ruta_multiple(jsonb)' then 'v' else 's' end
 and p.proconfig @> array['search_path=pg_catalog','TimeZone=UTC','DateStyle=ISO, YMD']::text[]
 and cardinality(p.proconfig)=3
 ) then raise exception 'ATRIBUTOS_FASE_2_INCOMPATIBLES: %',firma; end if;
 -- ACL exacta de Fase 2: dueño y authenticated, sin delegación a terceros.
 if exists(
 select 1 from pg_catalog.pg_proc p,
 lateral pg_catalog.aclexplode(coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner))) a
 where p.oid=pg_catalog.to_regprocedure(firma)
 and (a.grantee not in ('postgres'::regrole::oid,'authenticated'::regrole::oid)
 or a.grantor<>'postgres'::regrole::oid or a.privilege_type<>'EXECUTE'
 or (a.grantee='authenticated'::regrole::oid and a.is_grantable))
 ) or not has_function_privilege('authenticated',firma,'EXECUTE')
 or has_function_privilege('anon',firma,'EXECUTE')
 or has_function_privilege('service_role',firma,'EXECUTE') then
 raise exception 'PERMISOS_FASE_2_INCOMPATIBLES: %',firma;
 end if;
 end loop;
 foreach firma in array array['public.confirmar_entrega_todo_correcto(uuid,bigint,uuid,jsonb,jsonb)',
 'public.registrar_entrega_fallida(uuid,bigint,uuid,text,text)',
 'operativo_privado.iniciar_operacion(uuid,bigint,uuid,text,jsonb)',
 'operativo_privado.completar_operacion(uuid,bigint,uuid,text,jsonb,uuid,text,jsonb,jsonb,jsonb)',
 'operativo_privado.permiso_reparto(uuid,date)', 'operativo_privado.leer_mi_reparto()'] loop
 if not exists(select 1 from pg_proc where oid=to_regprocedure(firma) and proowner='postgres'::regrole) then raise exception 'DEPENDENCIA_INCOMPATIBLE: %',firma; end if;
 end loop;
 foreach rol in array array['anon','authenticated','service_role'] loop
 if has_schema_privilege(rol,'operativo_privado','USAGE') or has_schema_privilege(rol,'operativo_privado','CREATE') or has_schema_privilege(rol,'public','CREATE') then raise exception 'ESQUEMA_NO_AISLADO: %',rol; end if;
 end loop;
end $pre$;
lock table public.pedidos, operativo_privado.rutas_multi, operativo_privado.ruta_multi_pedidos, operativo_privado.ruta_multi_repartidores in access exclusive mode nowait;
create or replace function public.operar_ruta_multiple(p_solicitud jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog set timezone='UTC' set datestyle='ISO, YMD' as $$
declare s jsonb:=p_solicitud; accion text:=s->>'accion'; rid uuid:=(s->>'ruta')::uuid;
 f date:=(s->>'fecha')::date; clave uuid:=(s->>'clave')::uuid; ver bigint:=(s->>'version')::bigint;
 r operativo_privado.rutas_multi%rowtype; h operativo_privado.ruta_multi_eventos%rowtype;
 p public.pedidos%rowtype; pv bigint; antes jsonb; resultado jsonb; cantidades jsonb; prep text; ids uuid[]; us uuid[];
 esadmin boolean; it jsonb; hist operativo_privado.historial_operativo%rowtype;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'AISLAMIENTO_NO_COMPATIBLE'; end if;
 esadmin:=auth.uid() is not null and coalesce(public.es_admin(),false);
 if auth.uid() is null or (not esadmin and not public.acceso_repartidor()) then raise exception 'NO_AUTORIZADO'; end if;
 if s is null or jsonb_typeof(s)<>'object' or rid is null or f is null or not isfinite(f) or clave is null or ver is null or ver<0
 or accion is null or accion not in ('crear','seleccionar','asignar','preparar','autorizar_parcial','salir','cerrar','ordenar','entregar','fallida','incorporar') then raise exception 'OPERACION_INVALIDA'; end if;
 -- Serializa con RPC anteriores y preparación. NOWAIT evita ciclos cliente ->
 -- pedido de las RPC contables: un conflicto revierte sin efectos parciales.
 lock table public.pedidos in exclusive mode nowait;
 perform pg_advisory_xact_lock(582051005);
 if not esadmin and (accion not in ('entregar','fallida','cerrar') or not exists(
 select 1 from operativo_privado.ruta_multi_repartidores a join operativo_privado.repartidores rp on rp.usuario_id=a.usuario_id and rp.activo
 join operativo_privado.rutas_multi rm on rm.id=a.ruta_id where a.ruta_id=rid and a.usuario_id=auth.uid() and rm.fecha=f)) then raise exception 'NO_AUTORIZADO'; end if;
 select e.* into h from operativo_privado.ruta_multi_eventos e where e.clave=(s->>'clave')::uuid;
 if found then
 if h.actor<>auth.uid() or h.solicitud<>s then raise exception 'CLAVE_IDEMPOTENCIA_EN_USO'; end if;
 return h.resultado - 'snapshot';
 end if;
 if exists(select 1 from operativo_privado.cargas where fecha=f) then raise exception 'JORNADA_LEGACY'; end if;
 if accion='crear' then
 if ver<>0 or nullif(btrim(s->>'nombre'),'') is null or length(btrim(s->>'nombre'))>100 then raise exception 'NOMBRE_INVALIDO'; end if;
 insert into public.rutas(id,fecha_operativa,nombre,creada_por) values(rid,f,btrim(s->>'nombre'),auth.uid());
 insert into operativo_privado.rutas_multi(id,fecha,nombre) values(rid,f,btrim(s->>'nombre'));
 end if;
 select * into r from operativo_privado.rutas_multi where id=rid for update;
 if not found or r.fecha<>f then raise exception 'RUTA_NO_ENCONTRADA'; end if;
 -- También consumir versión de ruta para invalidar asignaciones revocadas.
 if r.version<>ver then raise exception 'VERSION_RUTA_CONFLICTO'; end if;
 if r.estado='cerrada' or (r.estado='en_reparto' and accion not in ('cerrar','entregar','fallida','incorporar')) then raise exception 'RUTA_NO_EDITABLE'; end if;
 antes:=operativo_privado.snapshot_ruta_multi(rid);
 if accion='incorporar' then
 if not esadmin or r.estado<>'en_reparto' then raise exception 'NO_AUTORIZADO'; end if;
 if nullif(btrim(s->>'motivo'),'') is null or length(s->>'motivo')>2000 then raise exception 'MOTIVO_REQUERIDO'; end if;
 if f is distinct from (clock_timestamp() at time zone 'America/Santiago')::date then raise exception 'PREPARACION_FECHA_NO_HABILITADA'; end if;
 if jsonb_typeof(s->'pedidos') is distinct from 'array' or jsonb_array_length(s->'pedidos')=0 then raise exception 'SELECCION_INVALIDA'; end if;
 select array_agg(value::uuid) into ids from jsonb_array_elements_text(s->'pedidos');
 if cardinality(ids)<>(select count(distinct x) from unnest(ids) x)
 or exists(select 1 from operativo_privado.ruta_multi_pedidos where pedido_id=any(ids))
 or exists(select 1 from operativo_privado.carga_pedidos where pedido_id=any(ids))
 or (select count(*) from public.pedidos where id=any(ids) and fecha_entrega=f and estado='listo_despacho' and regimen_contable='entrega_v1')<>cardinality(ids) then raise exception 'SELECCION_INVALIDA'; end if;
 if not exists(select 1 from operativo_privado.ruta_multi_repartidores a join operativo_privado.repartidores rp on rp.usuario_id=a.usuario_id and rp.activo where a.ruta_id=rid) then raise exception 'REPARTIDORES_REQUERIDOS'; end if;
 -- Sólo agrega: no elimina miembros, no cambia asignaciones ni reabre entregas.
 insert into operativo_privado.ruta_multi_pedidos(pedido_id,ruta_id,posicion)
 select x,rid,(select coalesce(max(posicion),0) from operativo_privado.ruta_multi_pedidos where ruta_id=rid)+n::integer
 from unnest(ids) with ordinality q(x,n);
 for p in select pe.* from public.pedidos pe join operativo_privado.ruta_multi_pedidos m on m.pedido_id=pe.id where m.ruta_id=rid and pe.id=any(ids) order by pe.id for update of pe loop
 if p.regimen_contable<>'entrega_v1' then raise exception 'REGIMEN_CONTABLE_NO_COMPATIBLE'; end if;
 if p.fecha_entrega<>f or p.estado<>'listo_despacho' or p.preparacion_finalizada_en is null then raise exception 'PEDIDO_NO_LISTO'; end if;
 perform 1 from public.items_pedido where pedido_id=p.id order by id for update;
 perform 1 from public.preparacion_items_pedido where pedido_id=p.id order by item_pedido_id for update;
 if not exists(select 1 from public.items_pedido where pedido_id=p.id) or exists(select 1 from public.items_pedido i left join public.preparacion_items_pedido pi on pi.item_pedido_id=i.id
 where i.pedido_id=p.id and (not coalesce(pi.confirmado_explicito,false) or pi.cantidad_preparada is null or pi.importe_linea_operativo is null)) then raise exception 'PRODUCTOS_PENDIENTES'; end if;
 prep:=operativo_privado.estado_preparacion_multi(p.id);
 if prep<>'listo' then raise exception 'INCORPORACION_REQUIERE_LISTO'; end if;
 select coalesce((select version from operativo_privado.versiones_pedido where pedido_id=p.id),0) into pv;
 perform operativo_privado.iniciar_operacion(p.id,pv,clave,'ruta_multiple_incorporar',s);
 insert into operativo_privado.ruta_multi_capacidad values(txid_current(),auth.uid(),rid,p.id,'salir');
 update public.pedidos set estado='en_reparto' where id=p.id;
 delete from operativo_privado.ruta_multi_capacidad where transaccion=txid_current();
 perform operativo_privado.completar_operacion(p.id,pv,clave,'ruta_multiple_incorporar',s,null,btrim(s->>'motivo'),to_jsonb(p),
 jsonb_build_object('estado','en_reparto','preparacion',prep,'cantidades',operativo_privado.cantidades_ruta_multi(p.id)),jsonb_build_object('ruta',rid,'estado','en_reparto'));
 end loop;
 elsif accion in ('seleccionar','ordenar') then
 if jsonb_typeof(s->'pedidos') is distinct from 'array' then raise exception 'SELECCION_INVALIDA'; end if;
 select coalesce(array_agg(value::uuid),array[]::uuid[]) into ids from jsonb_array_elements_text(s->'pedidos');
 if cardinality(ids)<>(select count(distinct x) from unnest(ids) x) then raise exception 'SELECCION_INVALIDA'; end if;
 if accion='ordenar' and (select coalesce(array_agg(pedido_id order by pedido_id),array[]::uuid[]) from operativo_privado.ruta_multi_pedidos where ruta_id=rid)
 is distinct from (select coalesce(array_agg(x order by x),array[]::uuid[]) from unnest(ids) x) then raise exception 'SELECCION_INVALIDA'; end if;
 if exists(select 1 from operativo_privado.ruta_multi_pedidos where pedido_id=any(ids) and ruta_id<>rid) then raise exception 'PEDIDO_YA_ASIGNADO'; end if;
 if (select count(*) from public.pedidos where id=any(ids) and fecha_entrega=f and estado in ('recibido','en_revision','programado','confirmado','preparando','listo_despacho'))<>cardinality(ids)
 or exists(select 1 from operativo_privado.carga_pedidos where pedido_id=any(ids)) then raise exception 'SELECCION_INVALIDA'; end if;
 delete from operativo_privado.ruta_multi_autorizaciones where ruta_id=rid and not(pedido_id=any(ids));
 delete from operativo_privado.ruta_multi_pedidos where ruta_id=rid;
 insert into operativo_privado.ruta_multi_pedidos(pedido_id,ruta_id,posicion) select x,rid,n::integer from unnest(ids) with ordinality u(x,n);
 elsif accion='asignar' then
 if jsonb_typeof(s->'repartidores') is distinct from 'array' then raise exception 'REPARTIDOR_NO_HABILITADO'; end if;
 select coalesce(array_agg(value::uuid),array[]::uuid[]) into us from jsonb_array_elements_text(s->'repartidores');
 if cardinality(us)<>(select count(*) from operativo_privado.repartidores rp join public.perfiles pf on pf.usuario_id=rp.usuario_id where rp.usuario_id=any(us) and rp.activo and pf.rol<>'admin') then raise exception 'REPARTIDOR_NO_HABILITADO'; end if;
 delete from operativo_privado.ruta_multi_repartidores where ruta_id=rid;
 insert into operativo_privado.ruta_multi_repartidores select rid,x from unnest(us) x;
 elsif accion='preparar' then
 if f is distinct from (clock_timestamp() at time zone 'America/Santiago')::date then raise exception 'PREPARACION_FECHA_NO_HABILITADA'; end if;
 if r.estado<>'planificacion' then raise exception 'RUTA_NO_EDITABLE'; end if;
 update operativo_privado.rutas_multi set estado='preparacion' where id=rid;
 elsif accion='autorizar_parcial' then
 if r.estado<>'preparacion' then raise exception 'RUTA_NO_EDITABLE'; end if;
 select pe.* into p from public.pedidos pe join operativo_privado.ruta_multi_pedidos m on m.pedido_id=pe.id where m.ruta_id=rid and pe.id=(s->>'pedido')::uuid for update of pe;
 if not found or operativo_privado.estado_preparacion_multi(p.id)<>'parcial' then raise exception 'AUTORIZACION_INVALIDA'; end if;
 select coalesce((select version from operativo_privado.versiones_pedido where pedido_id=p.id),0) into pv;
 if pv is distinct from (s->>'version_pedido')::bigint then raise exception 'VERSION_OPERATIVA_CONFLICTO'; end if;
 if nullif(btrim(s->>'motivo'),'') is null or length(s->>'motivo')>2000 then raise exception 'MOTIVO_REQUERIDO'; end if;
 cantidades:=operativo_privado.cantidades_ruta_multi(p.id);
 insert into operativo_privado.ruta_multi_autorizaciones(ruta_id,pedido_id,version,cantidades,motivo,actor)
 values(rid,p.id,pv,cantidades,btrim(s->>'motivo'),auth.uid()) on conflict(ruta_id,pedido_id) do update set
 version=excluded.version,cantidades=excluded.cantidades,motivo=excluded.motivo,actor=excluded.actor,instante=clock_timestamp();
 elsif accion='salir' then
 if r.estado<>'preparacion' then raise exception 'RUTA_NO_EDITABLE'; end if;
 if not exists(select 1 from operativo_privado.ruta_multi_pedidos where ruta_id=rid) then raise exception 'RUTA_VACIA'; end if;
 if not exists(select 1 from operativo_privado.ruta_multi_repartidores where ruta_id=rid) then raise exception 'REPARTIDORES_REQUERIDOS'; end if;
 if exists(select 1 from operativo_privado.ruta_multi_repartidores a where a.ruta_id=rid and not exists(select 1 from operativo_privado.repartidores rp join public.perfiles pf on pf.usuario_id=rp.usuario_id where rp.usuario_id=a.usuario_id and rp.activo and pf.rol<>'admin')) then raise exception 'REPARTIDOR_NO_HABILITADO'; end if;
 for p in select pe.* from public.pedidos pe join operativo_privado.ruta_multi_pedidos m on m.pedido_id=pe.id where m.ruta_id=rid order by pe.id for update of pe loop
 if p.regimen_contable<>'entrega_v1' then raise exception 'REGIMEN_CONTABLE_NO_COMPATIBLE'; end if;
 if p.fecha_entrega<>f or p.estado<>'listo_despacho' or p.preparacion_finalizada_en is null then raise exception 'PEDIDO_NO_LISTO'; end if;
 perform 1 from public.items_pedido where pedido_id=p.id order by id for update;
 perform 1 from public.preparacion_items_pedido where pedido_id=p.id order by item_pedido_id for update;
 if not exists(select 1 from public.items_pedido where pedido_id=p.id) or exists(select 1 from public.items_pedido i left join public.preparacion_items_pedido pi on pi.item_pedido_id=i.id
 where i.pedido_id=p.id and (not coalesce(pi.confirmado_explicito,false) or pi.cantidad_preparada is null or pi.importe_linea_operativo is null)) then raise exception 'PRODUCTOS_PENDIENTES'; end if;
 prep:=operativo_privado.estado_preparacion_multi(p.id);
 if prep='sin_preparar' then raise exception 'SIN_PREPARAR'; end if;
 select coalesce((select version from operativo_privado.versiones_pedido where pedido_id=p.id),0) into pv;
 if prep='parcial' and not exists(select 1 from operativo_privado.ruta_multi_autorizaciones a where a.ruta_id=rid and a.pedido_id=p.id and a.version=pv and a.cantidades=operativo_privado.cantidades_ruta_multi(p.id)) then raise exception 'PARCIAL_NO_AUTORIZADO'; end if;
 perform operativo_privado.iniciar_operacion(p.id,pv,clave,'ruta_multiple_salir',s);
 insert into operativo_privado.ruta_multi_capacidad values(txid_current(),auth.uid(),rid,p.id,'salir');
 update public.pedidos set estado='en_reparto' where id=p.id;
 delete from operativo_privado.ruta_multi_capacidad where transaccion=txid_current();
 perform operativo_privado.completar_operacion(p.id,pv,clave,'ruta_multiple_salir',s,null,'Salida explícita por ruta',to_jsonb(p),
 jsonb_build_object('estado','en_reparto','preparacion',prep,'cantidades',operativo_privado.cantidades_ruta_multi(p.id)),jsonb_build_object('ruta',rid,'estado','en_reparto'));
 end loop;
 if f is distinct from (clock_timestamp() at time zone 'America/Santiago')::date then raise exception 'PREPARACION_FECHA_NO_HABILITADA'; end if;
 update operativo_privado.rutas_multi set estado='en_reparto',salida_en=clock_timestamp() where id=rid;
 elsif accion in ('entregar','fallida') then
 if r.estado<>'en_reparto' then raise exception 'RUTA_NO_EDITABLE'; end if;
 select pe.* into p from public.pedidos pe join operativo_privado.ruta_multi_pedidos m on m.pedido_id=pe.id where m.ruta_id=rid and pe.id=(s->>'pedido')::uuid;
 if not found then raise exception 'NO_AUTORIZADO'; end if;
 perform 1 from public.clientes where id=p.cliente_id for update nowait;
 insert into operativo_privado.ruta_multi_capacidad values(txid_current(),auth.uid(),rid,p.id,accion);
 if accion='entregar' then
 select * into hist from operativo_privado.historial_operativo where pedido_id=p.id and clave_idempotencia=clave;
 if found then it:=hist.solicitud->'items';
 else select jsonb_agg(jsonb_build_object('item_pedido_id',i.id,'cantidad_entregada',pi.cantidad_preparada) order by i.id) into it
 from public.items_pedido i join public.preparacion_items_pedido pi on pi.item_pedido_id=i.id where i.pedido_id=p.id; end if;
 perform public.confirmar_entrega_todo_correcto(p.id,(s->>'version_pedido')::bigint,clave,it,
 '{"metodo":"por_pagar","efectivo":0,"transferencia":0,"confirmar_por_pagar":true}'::jsonb);
 else perform public.registrar_entrega_fallida(p.id,(s->>'version_pedido')::bigint,clave,s->>'motivo',s->>'observaciones'); end if;
 delete from operativo_privado.ruta_multi_capacidad where transaccion=txid_current();
 elsif accion='cerrar' then
 if r.estado<>'en_reparto' then raise exception 'RUTA_NO_EDITABLE'; end if;
 if exists(select 1 from operativo_privado.ruta_multi_pedidos m join public.pedidos pe on pe.id=m.pedido_id where m.ruta_id=rid and pe.estado not in ('entregado','entrega_fallida')) then raise exception 'PEDIDOS_PENDIENTES'; end if;
 -- La evidencia de cada fallo/venta fue validada por sus barreras actuales.
 -- Congela sólo los pedidos, cantidades, actores y eventos de ESTA ruta.
 update operativo_privado.rutas_multi set estado='cerrada',cierre=antes||jsonb_build_object('cerrada_en',clock_timestamp(),'cerrada_por',auth.uid()) where id=rid;
 end if;
 update operativo_privado.rutas_multi set version=version+1 where id=rid;
 resultado:=jsonb_build_object('ok',true,'ruta',rid,'version',r.version+1);
 if accion='incorporar' then
 resultado:=resultado||jsonb_build_object('modalidad',case when exists(
 select 1 from jsonb_array_elements(antes->'pedidos') x where x->'pedido'->>'estado' in ('entregado','entrega_fallida'))
 then 'incorporacion_extraordinaria' else 'modificacion_controlada' end,'pedidos_agregados',to_jsonb(ids));
 end if;
 insert into operativo_privado.ruta_multi_eventos(clave,ruta_id,actor,solicitud,anterior,resultado)
 values(clave,rid,auth.uid(),s,antes,resultado||jsonb_build_object('snapshot',operativo_privado.snapshot_ruta_multi(rid)));
 return resultado;
end $$;
create or replace function public.leer_rutas_multiples(p_fecha date) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog set timezone='UTC' set datestyle='ISO, YMD' as $$
begin
 if auth.uid() is null or not coalesce(public.es_admin(),false) then raise exception 'NO_AUTORIZADO'; end if;
 if p_fecha is null or not isfinite(p_fecha) then raise exception 'FECHA_INVALIDA'; end if;
 return jsonb_build_object('contrato',3,'legado',exists(select 1 from operativo_privado.cargas where fecha=p_fecha),
 'rutas',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'nombre',r.nombre,'estado',r.estado,'version',r.version,
 'pedidos',coalesce((select jsonb_agg(pedido_id order by posicion,pedido_id) from operativo_privado.ruta_multi_pedidos where ruta_id=r.id),'[]'::jsonb),
 'repartidores',coalesce((select jsonb_agg(usuario_id order by usuario_id) from operativo_privado.ruta_multi_repartidores where ruta_id=r.id),'[]'::jsonb),
 'autorizaciones',coalesce((select jsonb_agg(jsonb_build_object('pedido',pedido_id,'version',version,'motivo',motivo,'actor',actor,'cantidades',cantidades) order by pedido_id) from operativo_privado.ruta_multi_autorizaciones where ruta_id=r.id),'[]'::jsonb),
 'historial',coalesce((select jsonb_agg(jsonb_build_object('clave',e.clave,'actor',e.actor,'instante',e.instante,'accion',e.solicitud->>'accion','motivo',e.solicitud->>'motivo','pedido',e.solicitud->>'pedido','resultado',e.resultado-'snapshot') order by e.instante,e.clave) from operativo_privado.ruta_multi_eventos e where e.ruta_id=r.id),'[]'::jsonb),
 'contadores',(select jsonb_build_object('sin_preparar',count(*) filter(where operativo_privado.estado_preparacion_multi(p.id)='sin_preparar'),
 'parciales',count(*) filter(where operativo_privado.estado_preparacion_multi(p.id)='parcial'),
 'pendientes_entrega',count(*) filter(where p.estado not in ('en_reparto','entregado','entrega_fallida')),
 'preparados',count(*) filter(where operativo_privado.estado_preparacion_multi(p.id)='listo'),
 'en_reparto',count(*) filter(where p.estado='en_reparto'),'entregados',count(*) filter(where p.estado='entregado'),
 'no_entregados',count(*) filter(where p.estado='entrega_fallida'),'pendientes',count(*) filter(where p.estado not in ('entregado','entrega_fallida')))
 from operativo_privado.ruta_multi_pedidos m join public.pedidos p on p.id=m.pedido_id where m.ruta_id=r.id)) order by r.nombre,r.id)
 from operativo_privado.rutas_multi r where r.fecha=p_fecha),'[]'::jsonb),
 'repartidores',coalesce((select jsonb_agg(jsonb_build_object('usuario_id',rp.usuario_id,'nombre',coalesce(p.nombre,'Repartidor')) order by p.nombre,rp.usuario_id)
 from operativo_privado.repartidores rp join public.perfiles p on p.usuario_id=rp.usuario_id where rp.activo and p.rol<>'admin'),'[]'::jsonb));
end $$;
create or replace function public.leer_mi_reparto() returns jsonb
language sql stable security definer set search_path=pg_catalog set timezone='UTC' set datestyle='ISO, YMD' as $$
 select case when public.acceso_repartidor() then operativo_privado.leer_mi_reparto() || coalesce((
 select jsonb_agg(jsonb_build_object('ruta',r.id,'nombre',r.nombre,'fecha',r.fecha,'asignacion',r.version,'estado','en_ruta',
 'pedidos',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'numero',p.numero_pedido,'cliente',p.nombre_cliente_snapshot,
 'direccion',concat_ws(', ',p.direccion_snapshot,p.comuna_snapshot,p.region_snapshot),'telefono',p.telefono_cliente_snapshot,'referencia',p.referencia_direccion_snapshot,
 'estado',p.estado,'preparacion',operativo_privado.estado_preparacion_multi(p.id),'version',coalesce(v.version,0),'posicion',m.posicion,
 'productos',coalesce((select jsonb_agg(jsonb_build_object('nombre',i.nombre_producto_snapshot,'cantidad',pi.cantidad_preparada,'solicitada',i.cantidad,'faltante',greatest(i.cantidad-pi.cantidad_preparada,0),'unidad',i.unidad_snapshot) order by i.id)
 from public.items_pedido i join public.preparacion_items_pedido pi on pi.item_pedido_id=i.id where i.pedido_id=p.id),'[]'::jsonb)) order by m.posicion,p.id)
 from operativo_privado.ruta_multi_pedidos m join public.pedidos p on p.id=m.pedido_id left join operativo_privado.versiones_pedido v on v.pedido_id=p.id where m.ruta_id=r.id),'[]'::jsonb)) order by r.fecha,r.nombre,r.id)
 from operativo_privado.rutas_multi r join operativo_privado.ruta_multi_repartidores a on a.ruta_id=r.id
 join operativo_privado.repartidores rp on rp.usuario_id=a.usuario_id and rp.activo
 where a.usuario_id=auth.uid() and r.estado='en_reparto'),'[]'::jsonb) else '[]'::jsonb end;
$$;

-- CREATE OR REPLACE conserva OID, propietario y ACL. Se explicitan permisos mínimos.
revoke all on function public.operar_ruta_multiple(jsonb), public.leer_rutas_multiples(date), public.leer_mi_reparto() from public,anon,authenticated,service_role;
grant execute on function public.operar_ruta_multiple(jsonb), public.leer_rutas_multiples(date), public.leer_mi_reparto() to authenticated;
notify pgrst, 'reload schema';
commit;
