-- Instalación exclusivamente MANUAL después de terminar_ruta_fase2,
-- no_entregados_fase3 y no_entregados_fase4. No ejecutado por Codex.
-- Admite rutas_multiples_fase2 y sus RPC posteriores sin modificarlas.
-- Bloqueos originales: exigir_fecha_legacy en la RPC; multi_barrera_cargas y
-- multi_barrera_seleccion; JORNADA_LEGACY y SELECCION_INVALIDA en operar_ruta_multiple.
-- Corrección mínima: destino multi sin carga ni selección legacy persistidas.
-- El pedido queda listo_despacho sin ruta; seleccionar/incorporar sigue siendo
-- una operación explícita con sus permisos, versiones y auditoría originales.
-- No cambia rutas, miembros, cierres, preparación, precios ni ventas existentes.
begin;

-- Admite también la revisión anterior de este complemento (huellas explícitas).
-- Reconocer los cuerpos originales antes de reemplazarlos explícitamente.
-- No se hacen sustituciones textuales sobre funciones instaladas. Una variante
-- desconocida aborta la transacción completa; OID, ACL y firmas se conservan.
do $contrato$
begin
 if current_user<>'postgres' or current_setting('transaction_isolation')<>'read committed'
 or current_setting('session_replication_role')<>'origin' then
 raise exception 'REQUIERE_POSTGRES_READ_COMMITTED_TRIGGERS_ORIGIN'; end if;
 if not exists(select 1 from pg_proc where oid=to_regprocedure('public.reprogramar_no_entregado_administrativo(uuid,bigint,uuid,date,text)')
 and proowner='postgres'::regrole and prosecdef
 and proargnames=array['p_pedido_id','p_version_esperada','p_clave','p_fecha','p_motivo']::text[]
 and prorettype='jsonb'::regtype and not proretset and not proisstrict and provolatile='v'
 and prolang=(select oid from pg_language where lanname='plpgsql')
 and proconfig @> array['search_path=pg_catalog','TimeZone=UTC','DateStyle=ISO, YMD']::text[]
 and cardinality(proconfig)=3
 and md5(replace(prosrc,chr(13)||chr(10),chr(10))) in ('29ff5650d5e2809e3677e9de957a0bca','d56c21551df8e36a0d5c9cc26b626d5b','e333d076a38ae08d9f08fe5d669d4611')) then
 raise exception 'CONTRATO_REPROGRAMACION_INCOMPATIBLE'; end if;
 if not exists(select 1 from pg_proc where oid=to_regprocedure('operativo_privado.proteger_cierre_carga()')
 and proowner='postgres'::regrole and prosecdef
 and md5(replace(prosrc,chr(13)||chr(10),chr(10))) in ('fb05f76d7dbc31ff2e118e8306b2b49b','c2c7ec7041dbe9435b15207d45fca5e9')) then
 raise exception 'CONTRATO_CIERRE_INCOMPATIBLE'; end if;
 if not exists(select 1 from pg_proc where oid=to_regprocedure('operativo_privado.permite_reprogramacion(oid,jsonb,jsonb)')
 and proowner='postgres'::regrole and prosecdef
 and md5(replace(prosrc,chr(13)||chr(10),chr(10)))='af7bf8198bf30f9fc9290a7cdd6919b6') then
 raise exception 'CONTRATO_CAPACIDAD_INCOMPATIBLE'; end if;
end; $contrato$;

-- La tabla de rutas individuales puede no estar instalada. La lectura dinámica
-- evita una dependencia DDL; no concede acceso a la tabla privada.
create or replace function operativo_privado.fecha_reprogramacion_tiene_rutas_multi(p_fecha date)
returns boolean language plpgsql stable security definer set search_path=pg_catalog as $$
declare existe boolean;
begin
 if to_regclass('operativo_privado.rutas_multi') is null then return false; end if;
 execute 'select exists(select 1 from operativo_privado.rutas_multi where fecha=$1)' into existe using p_fecha;
 return existe;
end; $$;
alter function operativo_privado.fecha_reprogramacion_tiene_rutas_multi(date) owner to postgres;
revoke all on function operativo_privado.fecha_reprogramacion_tiene_rutas_multi(date) from public,anon,authenticated,service_role;

-- Rutas cerradas permanecen cerradas. Basta una ruta que admita selección
-- o incorporación explícita; nunca se crea una carga legacy sobre rutas multi.
create or replace function operativo_privado.fecha_reprogramacion_admite_pedidos(p_fecha date)
returns boolean language plpgsql stable security definer set search_path=pg_catalog as $$
declare abierta boolean; incorpora boolean;
begin
 if operativo_privado.fecha_reprogramacion_tiene_rutas_multi(p_fecha) then
 if exists(select 1 from operativo_privado.cargas where fecha=p_fecha) then return false; end if;
 -- Fase 2 no ofrece incorporar en reparto; no prometer esa posibilidad.
 select md5(replace(prosrc,chr(13)||chr(10),chr(10))) in ('3258c2545d0c9dd5960f60bf1d0d103b','d8c2db86f702c3a1174dd1374207009d') into incorpora
 from pg_proc where oid=to_regprocedure('public.operar_ruta_multiple(jsonb)');
 execute 'select exists(select 1 from operativo_privado.rutas_multi where fecha=$1 and (estado in (''planificacion'',''preparacion'') or (estado=''en_reparto'' and $2 and fecha=(statement_timestamp() at time zone ''America/Santiago'')::date and exists(select 1 from operativo_privado.ruta_multi_repartidores a join operativo_privado.repartidores rp on rp.usuario_id=a.usuario_id and rp.activo where a.ruta_id=rutas_multi.id))))'
 into abierta using p_fecha,coalesce(incorpora,false);
 return abierta;
 end if;
 return not exists(select 1 from operativo_privado.cargas where fecha=p_fecha and estado<>'preparacion');
end; $$;
alter function operativo_privado.fecha_reprogramacion_admite_pedidos(date) owner to postgres;
revoke all on function operativo_privado.fecha_reprogramacion_admite_pedidos(date) from public,anon,authenticated,service_role;

-- Usa exactamente la disponibilidad comercial del creador: America/Santiago,
-- días activos, corte exclusivo y horizonte de 14 días. No se amplía el plazo
-- para completar diez opciones cuando hay menos fechas válidas.
-- La elegibilidad no es ausencia de fechas. Solo consulta evidencia, sin locks ni escrituras.
create or replace function operativo_privado.exigir_pedido_reprogramable(p_pedido_id uuid)
returns date language plpgsql stable security definer set search_path=pg_catalog as $$
declare p public.pedidos%rowtype; cp operativo_privado.carga_pedidos%rowtype;
 c operativo_privado.cargas%rowtype; intento jsonb;
 fallo operativo_privado.historial_operativo%rowtype; version_actual bigint;
begin
 select * into p from public.pedidos where id=p_pedido_id;
 if not found then raise exception 'PEDIDO_NO_ENCONTRADO'; end if;
 if p.estado is distinct from 'entrega_fallida' or p.preparacion_finalizada_en is null
 or p.venta_definitiva_snapshot is not null or p.venta_reconocida_en is not null
 or exists(select 1 from operativo_privado.entregas_definitivas where pedido_id=p.id) then
 raise exception 'PEDIDO_NO_REPROGRAMABLE'; end if;
 select * into cp from operativo_privado.carga_pedidos where pedido_id=p.id;
 if not found or not cp.incluido then raise exception 'PEDIDO_NO_REPROGRAMABLE'; end if;
 select * into c from operativo_privado.cargas where fecha=cp.fecha;
 if not found or c.estado is distinct from 'cerrada' then raise exception 'CIERRE_REQUERIDO'; end if;
 select coalesce((select version from operativo_privado.versiones_pedido where pedido_id=p.id),0) into version_actual;
 -- No trasladar una selección sin su intento cerrado y evento de fallo exactos.
 -- La versión del cierre puede preceder otras operaciones auditadas sin cambio
 -- de estado; se enlaza el fallo por su propia versión, no por la versión actual.
 select x into intento from jsonb_array_elements(c.resumen_cierre->'intentos') x
 where x->'pedido'->>'id'=p.id::text;
 select * into fallo from operativo_privado.historial_operativo
 where pedido_id=p.id and operacion='entrega_fallida' order by version desc limit 1;
 if intento is null or fallo.pedido_id is null
 or intento->'pedido' is distinct from to_jsonb(p)
 or intento->'seleccion' is distinct from to_jsonb(cp)
 or intento->'fallo' is distinct from to_jsonb(fallo)
 or jsonb_typeof(intento->'version') is distinct from 'number'
 or (intento->>'version')::bigint>version_actual
 or intento->'motivo' is distinct from to_jsonb(fallo.motivo)
 or fallo.version>(intento->>'version')::bigint
 or fallo.valores_nuevos->>'estado' is distinct from 'entrega_fallida'
 or not exists(select 1 from operativo_privado.historial_cargas h
 where h.fecha=cp.fecha and h.version=c.version and h.resultado=c.resumen_cierre
 and h.solicitud->>'accion'='cerrar') then
 raise exception 'TRAZABILIDAD_INTENTO_INVALIDA'; end if;
 return cp.fecha;
end; $$;
alter function operativo_privado.exigir_pedido_reprogramable(uuid) owner to postgres;
revoke all on function operativo_privado.exigir_pedido_reprogramable(uuid) from public,anon,authenticated,service_role;

create or replace function public.leer_fechas_reprogramacion_admin(p_pedido_id uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare fechas jsonb; fecha_origen date;
begin
 if auth.uid() is null or not coalesce(public.es_admin(),false) then raise exception 'NO_AUTORIZADO'; end if;
 fecha_origen:=operativo_privado.exigir_pedido_reprogramable(p_pedido_id);
 select coalesce(jsonb_agg(x.fecha order by x.fecha),'[]'::jsonb) into fechas from (
 select (statement_timestamp() at time zone 'America/Santiago')::date + n as fecha
 from generate_series(0,14) n
 where (statement_timestamp() at time zone 'America/Santiago')::date+n>fecha_origen
 and public.fecha_entrega_disponible((statement_timestamp() at time zone 'America/Santiago')::date+n,statement_timestamp())
 and operativo_privado.fecha_reprogramacion_admite_pedidos((statement_timestamp() at time zone 'America/Santiago')::date+n)
 order by fecha limit 10) x;
 return fechas;
end; $$;

alter function public.leer_fechas_reprogramacion_admin(uuid) owner to postgres;
revoke all on function public.leer_fechas_reprogramacion_admin(uuid) from public,anon,authenticated,service_role;
grant execute on function public.leer_fechas_reprogramacion_admin(uuid) to authenticated;

-- Única ampliación de la barrera de cierre: DELETE con capacidad privada exacta,
-- vinculada a actor/transacción y selección_despues = JSON null.
create or replace function operativo_privado.proteger_cierre_carga() returns trigger
language plpgsql security definer set search_path=pg_catalog set timezone='UTC' set datestyle='ISO, YMD' as $$
begin
 -- Una snapshot REPEATABLE READ anterior al cierre podría ocultarlo en triggers.
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'AISLAMIENTO_NO_COMPATIBLE'; end if;
 if TG_TABLE_NAME='cargas' then
 if old.estado='cerrada' then raise exception 'RUTA_CERRADA'; end if;
 else
 -- Bloquea AMBAS jornadas, en orden, al trasladar una selección.
 perform 1 from operativo_privado.cargas
 where fecha in (case when TG_OP='INSERT' then new.fecha else old.fecha end,
 case when TG_OP='DELETE' then old.fecha else new.fecha end) order by fecha for update;
 if TG_OP='DELETE' and operativo_privado.permite_reprogramacion(TG_RELID,to_jsonb(old),'null'::jsonb) then return old; end if;
 if TG_OP='UPDATE' and operativo_privado.permite_reprogramacion(TG_RELID,to_jsonb(old),to_jsonb(new)) then return new; end if;
 if exists(select 1 from operativo_privado.cargas where estado='cerrada'
 and (fecha=case when TG_OP='INSERT' then new.fecha else old.fecha end
 or fecha=case when TG_OP='DELETE' then old.fecha else new.fecha end)) then raise exception 'RUTA_CERRADA'; end if;
 end if;
 if TG_OP='DELETE' then return old; end if;
 return new;
end; $$;

-- Cuerpo completo original con bifurcación exclusiva del destino multi.
create or replace function public.reprogramar_no_entregado_administrativo(
 p_pedido_id uuid,p_version_esperada bigint,p_clave uuid,p_fecha date,p_motivo text
) returns jsonb language plpgsql security definer set search_path=pg_catalog set timezone='UTC' set datestyle='ISO, YMD' as $$
declare p public.pedidos%rowtype; cp operativo_privado.carga_pedidos%rowtype;
 c operativo_privado.cargas%rowtype; destino operativo_privado.cargas%rowtype;
 solicitud jsonb; inicio jsonb; despues jsonb; seleccion jsonb; respuesta jsonb;
 multi boolean; intento jsonb; fallo operativo_privado.historial_operativo%rowtype;
begin
 if auth.uid() is null or not coalesce(public.es_admin(),false) then raise exception 'NO_AUTORIZADO'; end if;
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'AISLAMIENTO_NO_COMPATIBLE'; end if;
 if p_fecha is null or not isfinite(p_fecha) or nullif(btrim(p_motivo),'') is null or length(p_motivo)>2000 then raise exception 'OPERACION_INVALIDA'; end if;
 -- Mismo orden global que operar/cerrar; no se toman locks de cliente ni dinero.
 lock table public.pedidos in exclusive mode;
 solicitud:=jsonb_build_object('fecha',p_fecha,'motivo',p_motivo,'contrato',1);
 inicio:=operativo_privado.iniciar_operacion(p_pedido_id,p_version_esperada,p_clave,'reprogramar_no_entregado',solicitud);
 if (inicio->>'reintento')::boolean then return inicio; end if;
 perform operativo_privado.exigir_pedido_reprogramable(p_pedido_id);
 if not public.fecha_entrega_disponible(p_fecha,clock_timestamp())
 or p_fecha>(clock_timestamp() at time zone 'America/Santiago')::date+14 then
 raise exception 'FECHA_ENTREGA_NO_DISPONIBLE'; end if;
 select * into p from public.pedidos where id=p_pedido_id;
 select * into cp from operativo_privado.carga_pedidos where pedido_id=p.id;
 if not found or not cp.incluido then raise exception 'PEDIDO_NO_REPROGRAMABLE'; end if;
 if p_fecha<=cp.fecha or p_fecha<(clock_timestamp() at time zone 'America/Santiago')::date then raise exception 'FECHA_REPROGRAMACION_INVALIDA'; end if;
 -- Locks advisory en orden de fecha, antes de las filas de carga.
 perform pg_advisory_xact_lock(hashtextextended('carga:'||d::text,0))
 from (select cp.fecha d union select p_fecha) fechas order by d;
 -- El lock EXCLUSIVE de pedidos serializa también crear/cerrar/seleccionar
 -- rutas múltiples; sus RPC lo adquieren antes del advisory global multi.
 -- Igual que operar_carga_jornada: materializar sólo destino legacy tras advisory.
 -- Adquirir TODOS los locks de filas por fecha, igual que el trigger de selección;
 -- las lecturas individuales siguientes no introducen otro orden de bloqueo.
 multi:=operativo_privado.fecha_reprogramacion_tiene_rutas_multi(p_fecha);
 if not operativo_privado.fecha_reprogramacion_admite_pedidos(p_fecha) then
 raise exception 'CARGA_NO_EDITABLE'; end if;
 if not multi then
 insert into operativo_privado.cargas(fecha) values(p_fecha) on conflict do nothing;
 end if;
 perform 1 from operativo_privado.cargas
 where fecha in (cp.fecha,p_fecha) order by fecha for update;
 select * into c from operativo_privado.cargas where fecha=cp.fecha;
 if c.estado is distinct from 'cerrada' or p.estado<>'entrega_fallida'
 or p.venta_definitiva_snapshot is not null or p.venta_reconocida_en is not null
 or exists(select 1 from operativo_privado.entregas_definitivas where pedido_id=p.id)
 or p.preparacion_finalizada_en is null then raise exception 'PEDIDO_NO_REPROGRAMABLE'; end if;
 select * into destino from operativo_privado.cargas where fecha=p_fecha;
 if not multi and destino.estado is distinct from 'preparacion' then raise exception 'CARGA_NO_EDITABLE'; end if;
 -- No trasladar una selección sin su intento cerrado y evento de fallo exactos.
 -- La versión del cierre puede preceder otras operaciones auditadas sin cambio
 -- de estado; se enlaza el fallo por su propia versión, no por la versión actual.
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
 if exists(select 1 from operativo_privado.historial_cargas where fecha=p_fecha and clave=p_clave) then
 raise exception 'CLAVE_IDEMPOTENCIA_EN_USO'; end if;
 despues:=to_jsonb(p)||jsonb_build_object('fecha_entrega',p_fecha,'estado','listo_despacho');
 seleccion:=to_jsonb(cp)||jsonb_build_object('fecha',p_fecha,'incluido',false,'motivo','Pendiente de inclusión tras reprogramación administrativa');
 if multi then seleccion:='null'::jsonb; end if;
 insert into operativo_privado.permiso_reprogramacion values
 (p.id,txid_current(),auth.uid(),to_jsonb(p),despues,to_jsonb(cp),seleccion);
 update public.pedidos set fecha_entrega=p_fecha,estado='listo_despacho' where id=p.id;
 if multi then
 -- Retira sólo la selección viva exacta; la evidencia cerrada permanece intacta.
 delete from operativo_privado.carga_pedidos where pedido_id=p.id;
 else
 update operativo_privado.carga_pedidos set fecha=p_fecha,incluido=false,
 motivo=seleccion->>'motivo' where pedido_id=p.id;
 end if;
 delete from operativo_privado.permiso_reprogramacion where pedido_id=p.id;
 -- La PK de carga_pedidos es por pedido: trasladar libera la asignación vieja.
 -- Su evidencia histórica permanece en resumen_cierre e historial_operativo.
 respuesta:=operativo_privado.completar_operacion(p.id,p_version_esperada,p_clave,
 'reprogramar_no_entregado',solicitud,null,p_motivo,
 jsonb_build_object('pedido',to_jsonb(p),'seleccion',to_jsonb(cp),'cierre',c.resumen_cierre,
 'fallo',to_jsonb(fallo)),
 jsonb_build_object('pedido',(select to_jsonb(pe) from public.pedidos pe where id=p.id),'seleccion',seleccion),
 jsonb_build_object('pedido_id',p.id,'fecha',p_fecha,'estado','listo_despacho','incluido',false));
 if not multi then
 update operativo_privado.cargas set version=version+1 where fecha=p_fecha;
 insert into operativo_privado.historial_cargas(fecha,version,clave,actor,solicitud,anterior,resultado)
 values(p_fecha,destino.version+1,p_clave,auth.uid(),
 solicitud||jsonb_build_object('accion','recibir_reprogramado','pedido_id',p.id),to_jsonb(destino),
 jsonb_build_object('pedido_id',p.id,'version',destino.version+1,'origen',cp.fecha,
 'version_cierre_origen',c.version,'version_fallo',fallo.version,
 'version_operativa',respuesta->'version','clave_operativa',p_clave,
 'seleccion_anterior',to_jsonb(cp),'seleccion_nueva',seleccion));
 end if;
 if not public.fecha_entrega_disponible(p_fecha,clock_timestamp()) then
 raise exception 'FECHA_ENTREGA_NO_DISPONIBLE'; end if;
 return respuesta;
end; $$;
commit;
