-- Fase 4. Instalación MANUAL después de Fases 2 y 3. No ejecutar desde la aplicación.
begin;
-- Contratos locales auditados de Fases 2/3. Normalizar SOLO CRLF -> LF:
-- no se quitan espacios, comentarios, literales ni tokens del cuerpo.
-- El cuerpo LF de reprogramar tiene MD5 29ff5650d5e2809e3677e9de957a0bca;
-- el MISMO cuerpo con CRLF tiene MD5 601638d4def143573e36e4039665b292.
-- No sustituir las funciones instaladas ni aceptar otros cuerpos.
do $$
declare r record; rol text;
begin
 if current_user <> 'postgres' or not exists (
 select 1 from pg_roles where rolname='postgres' and (rolsuper or rolbypassrls)) then
 raise exception 'FASE4_REQUIERE_POSTGRES_CON_BYPASSRLS'; end if;
 if current_setting('transaction_isolation') <> 'read committed'
 or current_setting('session_replication_role') <> 'origin' then
 raise exception 'FASE4_REQUIERE_READ_COMMITTED_Y_TRIGGERS_ORIGIN'; end if;
 for r in select * from (values
 ('public.reprogramar_no_entregado_administrativo(uuid,bigint,uuid,date,text)',
 array['p_pedido_id','p_version_esperada','p_clave','p_fecha','p_motivo'],
 'jsonb','v',true,'29ff5650d5e2809e3677e9de957a0bca'),
 ('operativo_privado.permite_reprogramacion(oid,jsonb,jsonb)',
 array['p_tabla','p_antes','p_despues'],'boolean','v',true,'af7bf8198bf30f9fc9290a7cdd6919b6'),
 ('operativo_privado.proteger_pedido_ruta_cerrada()',null::text[],
 'trigger','v',true,'8a8d2f6237022ff861d28f453ac8629a'),
 ('operativo_privado.proteger_entrega_fallida()',null::text[],
 'trigger','v',true,'192cccdf6205e693e1979701bb964a30'),
 ('public.leer_intentos_pedido_admin(uuid)',array['p_pedido_id'],
 'jsonb','s',false,'3e49d05d83329b17b966575d8a5dc202'),
 ('public.leer_no_entregados_admin(text,date,date,integer)',
 array['p_busqueda','p_desde','p_hasta','p_pagina'],
 'jsonb','s',false,'17e62f92f323f42e2887d0a33cacd77c')
 ) v(firma,nombres,retorno,volatilidad,config_temporal,huella) loop
 if not exists(select 1 from pg_proc p join pg_language l on l.oid=p.prolang
 where p.oid=to_regprocedure(r.firma)
 and p.proargnames is not distinct from r.nombres
 and p.prorettype=to_regtype(r.retorno) and not p.proretset
 and p.prokind='f' and p.provolatile::text=r.volatilidad
 and not p.proisstrict and l.lanname='plpgsql'
 and p.prosecdef and p.proowner='postgres'::regrole
 and p.proconfig @> array['search_path=pg_catalog']::text[]
 and (not r.config_temporal or p.proconfig @> array['TimeZone=UTC','DateStyle=ISO, YMD']::text[])
 and cardinality(p.proconfig)=case when r.config_temporal then 3 else 1 end
 and md5(replace(p.prosrc,chr(13)||chr(10),chr(10)))=r.huella) then
 raise exception 'CONTRATO_FASE2_O_FASE3_INCOMPATIBLE: %',r.firma;
 end if;
 -- PUBLIC no es un rol consultable con has_function_privilege.
 if exists(select 1 from pg_proc p,
 lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
 where p.oid=to_regprocedure(r.firma) and a.grantee=0 and a.privilege_type='EXECUTE') then
 raise exception 'EXECUTE_PUBLICO_FASE4: %',r.firma; end if;
 foreach rol in array array['anon','authenticated','service_role'] loop
 if has_function_privilege(rol,to_regprocedure(r.firma),'EXECUTE')
 is distinct from (rol='authenticated' and r.firma like 'public.%') then
 raise exception 'PERMISOS_FUNCION_FASE4_INCOMPATIBLES: % (%)',r.firma,rol;
 end if;
 end loop;
 end loop;
 -- Validar eventos y granularidad además de función y habilitación.
 -- tgtype: ROW + BEFORE + INSERT/UPDATE = 23; ROW + BEFORE + UPDATE/DELETE = 27.
 for r in select * from (values
 ('proteger_entrega_fallida','operativo_privado.proteger_entrega_fallida()',23),
 ('proteger_pedido_ruta_cerrada','operativo_privado.proteger_pedido_ruta_cerrada()',27)
 ) v(nombre,firma,tipo) loop
 if not exists(select 1 from pg_trigger where tgrelid='public.pedidos'::regclass
 and tgname=r.nombre and tgfoid=to_regprocedure(r.firma) and tgtype=r.tipo
 and not tgisinternal and tgenabled in ('O','A') and tgqual is null
 and tgnargs=0
 and (tgattr::text='' or (r.nombre='proteger_entrega_fallida' and tgattr::text=(
 select attnum::text from pg_attribute where attrelid='public.pedidos'::regclass and attname='estado' and not attisdropped)))) then
 raise exception 'BARRERA_FASE2_NO_ACTIVA_O_INCOMPATIBLE: %',r.nombre; end if;
 end loop;
 -- La capacidad sigue aislada de los roles API, también bajo FORCE RLS.
 if not exists(select 1 from pg_class where oid=to_regclass('operativo_privado.permiso_reprogramacion')
 and relkind='r' and relowner='postgres'::regrole and relrowsecurity and relforcerowsecurity) then
 raise exception 'CAPACIDAD_FASE2_NO_AISLADA'; end if;
 foreach rol in array array['anon','authenticated','service_role'] loop
 if has_schema_privilege(rol,'operativo_privado','USAGE')
 or has_schema_privilege(rol,'operativo_privado','CREATE')
 or has_schema_privilege(rol,'public','CREATE')
 or has_table_privilege(rol,'operativo_privado.permiso_reprogramacion','SELECT,INSERT,UPDATE,DELETE,TRUNCATE')
 or has_any_column_privilege(rol,'operativo_privado.permiso_reprogramacion','SELECT,INSERT,UPDATE') then
 raise exception 'CAPACIDAD_FASE2_NO_AISLADA: %',rol; end if;
 end loop;
end; $$;

create function public.cancelar_no_entregado_administrativo(
 p_pedido_id uuid,p_version_esperada bigint,p_clave uuid,p_motivo text,p_tratamiento text
) returns jsonb language plpgsql security definer set search_path=pg_catalog set timezone='UTC' set datestyle='ISO, YMD' as $$
declare p public.pedidos%rowtype; cp operativo_privado.carga_pedidos%rowtype;
 c operativo_privado.cargas%rowtype; inicio jsonb; solicitud jsonb; intento jsonb;
 fallo operativo_privado.historial_operativo%rowtype; despues jsonb; respuesta jsonb;
begin
 if auth.uid() is null or not coalesce(public.es_admin(),false) then raise exception 'NO_AUTORIZADO'; end if;
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'AISLAMIENTO_NO_COMPATIBLE'; end if;
 if nullif(btrim(p_motivo),'') is null or length(p_motivo)>2000
 or nullif(btrim(p_tratamiento),'') is null or length(p_tratamiento)>2000 then raise exception 'TRATAMIENTO_ADMINISTRATIVO_REQUERIDO'; end if;
 -- Mismo orden global que cerrar/reprogramar. No adquiere locks de dinero.
 lock table public.pedidos in exclusive mode;
 solicitud:=jsonb_build_object('motivo',p_motivo,'tratamiento',p_tratamiento,'contrato',1);
 inicio:=operativo_privado.iniciar_operacion(p_pedido_id,p_version_esperada,p_clave,'cancelar_no_entregado',solicitud);
 if (inicio->>'reintento')::boolean then return inicio; end if;
 select * into p from public.pedidos where id=p_pedido_id;
 if p.estado<>'entrega_fallida' or p.venta_definitiva_snapshot is not null or p.venta_reconocida_en is not null
 or exists(select 1 from operativo_privado.entregas_definitivas where pedido_id=p.id) then raise exception 'PEDIDO_NO_CANCELABLE'; end if;
 -- Cancelar legado retiraría cargos de vistas históricas: se bloquea sin convertir régimen.
 if p.regimen_contable is distinct from 'entrega_v1' then raise exception 'SALDO_HISTORICO_REQUIERE_TRATAMIENTO'; end if;
 select * into cp from operativo_privado.carga_pedidos where pedido_id=p.id;
 if not found or not cp.incluido then raise exception 'PEDIDO_NO_CANCELABLE'; end if;
 perform pg_advisory_xact_lock(hashtextextended('carga:'||cp.fecha::text,0));
 select * into c from operativo_privado.cargas where fecha=cp.fecha for update;
 if c.estado is distinct from 'cerrada' then raise exception 'CIERRE_REQUERIDO'; end if;
 select x into intento from jsonb_array_elements(c.resumen_cierre->'intentos') x
 where x->'pedido'->>'id'=p.id::text;
 select * into fallo from operativo_privado.historial_operativo
 where pedido_id=p.id and operacion='entrega_fallida' order by version desc limit 1;
 if intento is null or fallo.pedido_id is null
 or intento->'pedido' is distinct from to_jsonb(p)
 or intento->'seleccion' is distinct from to_jsonb(cp)
 or intento->'fallo' is distinct from to_jsonb(fallo)
 or jsonb_typeof(intento->'version') is distinct from 'number'
 or (intento->>'version')::bigint>p_version_esperada
 or intento->'motivo' is distinct from to_jsonb(fallo.motivo)
 or fallo.version>(intento->>'version')::bigint
 or fallo.valores_nuevos->>'estado' is distinct from 'entrega_fallida'
 or not exists(select 1 from operativo_privado.historial_cargas h
 where h.fecha=cp.fecha and h.version=c.version and h.resultado=c.resumen_cierre
 and h.solicitud->>'accion'='cerrar') then
 raise exception 'TRAZABILIDAD_INTENTO_INVALIDA'; end if;
 despues:=to_jsonb(p)||jsonb_build_object('estado','cancelado');
 -- Capacidad privada ligada a transacción, actor y antes/después exactos.
 -- La selección no se modifica; el cierre original sigue inmutable.
 insert into operativo_privado.permiso_reprogramacion values
 (p.id,txid_current(),auth.uid(),to_jsonb(p),despues,to_jsonb(cp),to_jsonb(cp));
 update public.pedidos set estado='cancelado' where id=p.id;
 delete from operativo_privado.permiso_reprogramacion where pedido_id=p.id;
 respuesta:=operativo_privado.completar_operacion(p.id,p_version_esperada,p_clave,
 'cancelar_no_entregado',solicitud,null,p_motivo,
 jsonb_build_object('pedido',to_jsonb(p),'seleccion',to_jsonb(cp),'cierre',c.resumen_cierre,'fallo',to_jsonb(fallo),
 'aplicaciones',coalesce((select jsonb_agg(to_jsonb(a)) from public.aplicaciones_pago a where a.pedido_id=p.id),'[]'::jsonb)),
 jsonb_build_object('pedido',(select to_jsonb(pe) from public.pedidos pe where id=p.id),
 'tratamiento',p_tratamiento,'pagos_creditos_preservados',true),
 jsonb_build_object('pedido_id',p.id,'estado','cancelado','pagos_creditos_preservados',true));
 return respuesta;
end; $$;

-- La RPC de orden visual histórica materializa paradas para todos los pedidos
-- por fecha. No debe incorporar un reprogramado excluido por ese camino.
-- Es una dependencia indispensable: falla toda la escritura, sin paradas parciales.
create function operativo_privado.proteger_ruta_reprogramado_no_incluido()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
begin
 perform 1 from public.pedidos where id=new.pedido_id for share nowait;
 if exists(select 1 from operativo_privado.historial_operativo h
 where h.pedido_id=new.pedido_id and h.operacion='reprogramar_no_entregado')
 and not exists(select 1 from operativo_privado.carga_pedidos cp
 join public.rutas r on r.id=new.ruta_id and r.fecha_operativa=cp.fecha
 where cp.pedido_id=new.pedido_id and cp.incluido) then
 raise exception 'REPROGRAMADO_REQUIERE_INCLUSION_EXPLICITA'; end if;
 return new;
end; $$;
alter function operativo_privado.proteger_ruta_reprogramado_no_incluido() owner to postgres;
revoke all on function operativo_privado.proteger_ruta_reprogramado_no_incluido() from public,anon,authenticated,service_role;
create trigger proteger_ruta_reprogramado_no_incluido
 before insert or update on public.paradas_ruta
 for each row execute function operativo_privado.proteger_ruta_reprogramado_no_incluido();

-- Lectura acotada para obtener versión y resoluciones, también desde detalle/historial.
create function public.leer_resolucion_no_entregado_admin(p_pedido_id uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
begin
 if auth.uid() is null or not coalesce(public.es_admin(),false) then raise exception 'NO_AUTORIZADO'; end if;
 return jsonb_build_object('version',coalesce((select version::text from operativo_privado.versiones_pedido where pedido_id=p_pedido_id),'0'),
 'resoluciones',coalesce((select jsonb_agg(jsonb_build_object('id',h.id,'fecha',h.fecha,'actor',h.actor_id,
 'operacion',h.operacion,'motivo',h.motivo,'version',h.version::text,'tratamiento',h.solicitud->>'tratamiento',
 'fecha_nueva',h.solicitud->>'fecha') order by h.version)
 from operativo_privado.historial_operativo h where h.pedido_id=p_pedido_id
 and h.operacion in ('reprogramar_no_entregado','cancelar_no_entregado')),'[]'::jsonb));
end; $$;
alter function public.cancelar_no_entregado_administrativo(uuid,bigint,uuid,text,text) owner to postgres;
alter function public.leer_resolucion_no_entregado_admin(uuid) owner to postgres;
revoke all on function public.cancelar_no_entregado_administrativo(uuid,bigint,uuid,text,text),
 public.leer_resolucion_no_entregado_admin(uuid) from public,anon,authenticated,service_role;
grant execute on function public.cancelar_no_entregado_administrativo(uuid,bigint,uuid,text,text),
 public.leer_resolucion_no_entregado_admin(uuid) to authenticated;
commit;
