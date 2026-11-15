-- BORRADOR BLOQUEADO: NO INSTALAR. No es el SQL definitivo autorizado.
-- Faltan resultados reales de los bloques 1, 3 y 4 del diagnóstico.
-- Brecha local: leer_rutas_multiples reconstruye rutas cerradas desde miembros
-- vivos; el DELETE propuesto cambia esa lectura aunque preserve cierre/eventos.
-- No retirar este bloqueo sin contrastar producción y resolver esa lectura.
-- MANUAL: NO ejecutado. No aplicar antes de revisar el SELECT adjunto de HL-000081.
-- Requiere corregir_reprogramacion_no_entregados.sql y rutas múltiples fase 2/3.
-- Solo DDL; no modifica pedidos, asignaciones, cierres ni datos históricos al instalar.
-- Huellas desconocidas abortan: solicitar definiciones instaladas, no quitar guardas.
begin;
do $pendiente$
begin
 raise exception 'INSTALACION_BLOQUEADA_CONTRATOS_PRODUCCION_Y_LECTURA_HISTORICA_PENDIENTES';
end; $pendiente$;
lock table public.pedidos in access exclusive mode nowait;
do $contrato$
begin
 if current_user<>'postgres' or current_setting('transaction_isolation')<>'read committed'
 or current_setting('session_replication_role')<>'origin' then
 raise exception 'REQUIERE_POSTGRES_READ_COMMITTED_TRIGGERS_ORIGIN'; end if;
 if not exists(select 1 from pg_proc where oid=to_regprocedure('public.reprogramar_no_entregado_administrativo(uuid,bigint,uuid,date,text)') and proowner='postgres'::regrole and prosecdef and md5(replace(prosrc,chr(13)||chr(10),chr(10)))='4304db3a1af1e37e2d3f7b7aa93e6366') then raise exception 'CONTRATO_INCOMPATIBLE: public.reprogramar_no_entregado_administrativo(uuid,bigint,uuid,date,text)'; end if;
 if not exists(select 1 from pg_proc where oid=to_regprocedure('operativo_privado.exigir_pedido_reprogramable(uuid)') and proowner='postgres'::regrole and prosecdef and md5(replace(prosrc,chr(13)||chr(10),chr(10)))='ecda8e2625107a8cdfb50d763544ba90') then raise exception 'CONTRATO_INCOMPATIBLE: operativo_privado.exigir_pedido_reprogramable(uuid)'; end if;
 if not exists(select 1 from pg_proc where oid=to_regprocedure('operativo_privado.permite_reprogramacion(oid,jsonb,jsonb)') and proowner='postgres'::regrole and prosecdef and md5(replace(prosrc,chr(13)||chr(10),chr(10)))='af7bf8198bf30f9fc9290a7cdd6919b6') then raise exception 'BARRERA_INCOMPATIBLE: permite_reprogramacion'; end if;
 if not exists(select 1 from pg_proc where oid=to_regprocedure('operativo_privado.proteger_ruta_multi()') and proowner='postgres'::regrole and prosecdef and md5(replace(prosrc,chr(13)||chr(10),chr(10)))='d150e062ca1274a5cae4a2a969e345e5') then raise exception 'BARRERA_INCOMPATIBLE: proteger_ruta_multi'; end if;
 if not exists(select 1 from pg_proc where oid=to_regprocedure('operativo_privado.proteger_entrega_fallida()') and proowner='postgres'::regrole and prosecdef and md5(replace(prosrc,chr(13)||chr(10),chr(10)))='192cccdf6205e693e1979701bb964a30') then raise exception 'BARRERA_INCOMPATIBLE: proteger_entrega_fallida'; end if;
 if not exists(select 1 from pg_proc where oid=to_regprocedure('operativo_privado.proteger_pedido_ruta_cerrada()') and proowner='postgres'::regrole and prosecdef and md5(replace(prosrc,chr(13)||chr(10),chr(10)))='8a8d2f6237022ff861d28f453ac8629a') then raise exception 'BARRERA_INCOMPATIBLE: proteger_pedido_ruta_cerrada'; end if;
 if not exists(select 1 from pg_proc where oid=to_regprocedure('operativo_privado.snapshot_ruta_multi(uuid)') and proowner='postgres'::regrole and prosecdef and md5(replace(prosrc,chr(13)||chr(10),chr(10))) in ('4fc4a59274cd93d5ee774bf903dffdca')) then raise exception 'CONTRATO_INCOMPATIBLE: snapshot_ruta_multi'; end if;
 if not exists(select 1 from pg_proc where oid=to_regprocedure('operativo_privado.fecha_reprogramacion_admite_pedidos(date)') and proowner='postgres'::regrole and prosecdef and md5(replace(prosrc,chr(13)||chr(10),chr(10))) in ('fc015e0cb2475eb2f192a0be4fa8815a')) then raise exception 'CONTRATO_INCOMPATIBLE: fecha_reprogramacion_admite_pedidos'; end if;
 if not exists(select 1 from pg_proc where oid=to_regprocedure('operativo_privado.fecha_reprogramacion_tiene_rutas_multi(date)') and proowner='postgres'::regrole and prosecdef and md5(replace(prosrc,chr(13)||chr(10),chr(10))) in ('7093076fb9c90481e554fc6f2adbd049')) then raise exception 'CONTRATO_INCOMPATIBLE: fecha_reprogramacion_tiene_rutas_multi'; end if;
 if not exists(select 1 from pg_proc where oid=to_regprocedure('public.operar_ruta_multiple(jsonb)') and proowner='postgres'::regrole and prosecdef and md5(replace(prosrc,chr(13)||chr(10),chr(10))) in ('3e7bedaabab7ed3dd7058cafa3fb1f21','3258c2545d0c9dd5960f60bf1d0d103b','3258c2545d0c9dd5960f60bf1d0d103b')) then raise exception 'CONTRATO_INCOMPATIBLE: operar_ruta_multiple'; end if;
 if not exists(select 1 from pg_proc where oid=to_regprocedure('public.leer_fechas_reprogramacion_admin(uuid)') and proowner='postgres'::regrole and prosecdef and md5(replace(prosrc,chr(13)||chr(10),chr(10)))='eae3020cad9da964fa8c1cfabd2dde2c') then raise exception 'CONTRATO_INCOMPATIBLE: leer_fechas_reprogramacion_admin'; end if;
end; $contrato$;

create function operativo_privado.exigir_pedido_reprogramable_legacy_multi(p_pedido_id uuid)
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

-- Evidencia multi: pertenencia viva, snapshot exacto, fallo enlazado por clave,
-- actor y versión; evento de cierre exacto y posterior al evento fallido.
create function operativo_privado.evidencia_reprogramacion_multi(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog
set timezone='UTC' set datestyle='ISO, YMD' as $$
declare p public.pedidos%rowtype; m operativo_privado.ruta_multi_pedidos%rowtype;
 r operativo_privado.rutas_multi%rowtype; f operativo_privado.historial_operativo%rowtype;
 ef operativo_privado.ruta_multi_eventos%rowtype; ec operativo_privado.ruta_multi_eventos%rowtype;
 i jsonb; v bigint;
begin
 select * into p from public.pedidos where id=p_id;
 if not found then raise exception 'PEDIDO_NO_ENCONTRADO'; end if;
 if p.estado is distinct from 'entrega_fallida' or p.preparacion_finalizada_en is null
 or p.venta_definitiva_snapshot is not null or p.venta_reconocida_en is not null
 or exists(select 1 from operativo_privado.entregas_definitivas where pedido_id=p.id) then
 raise exception 'PEDIDO_NO_REPROGRAMABLE'; end if;
 if exists(select 1 from operativo_privado.carga_pedidos where pedido_id=p.id) then
 raise exception 'TRAZABILIDAD_INTENTO_INVALIDA'; end if;
 select * into m from operativo_privado.ruta_multi_pedidos where pedido_id=p.id;
 if not found then raise exception 'ASIGNACION_MULTI_REQUERIDA'; end if;
 select * into r from operativo_privado.rutas_multi where id=m.ruta_id;
 if r.estado is distinct from 'cerrada' or r.cierre is null then raise exception 'CIERRE_MULTI_REQUERIDO'; end if;
 select * into f from operativo_privado.historial_operativo where pedido_id=p.id and operacion='entrega_fallida' order by version desc limit 1;
 select version into v from operativo_privado.versiones_pedido where pedido_id=p.id;
 if p.fecha_entrega is distinct from r.fecha then raise exception 'SNAPSHOT_MULTI_INVALIDO'; end if;
 if f.pedido_id is null then raise exception 'FALLO_MULTI_NO_AUDITADO'; end if;
 if jsonb_typeof(r.cierre->'pedidos') is distinct from 'array' then raise exception 'SNAPSHOT_MULTI_INVALIDO'; end if;
 if (select count(*) from jsonb_array_elements(r.cierre->'pedidos') x where x->'pedido'->>'id'=p.id::text)<>1 then
 raise exception 'SNAPSHOT_MULTI_INVALIDO'; end if;
 select x into i from jsonb_array_elements(r.cierre->'pedidos') x where x->'pedido'->>'id'=p.id::text;
 if i->'pedido' is distinct from to_jsonb(p) or i->'posicion' is distinct from to_jsonb(m.posicion)
 or i->'preparacion' is distinct from coalesce((select jsonb_agg(to_jsonb(pi) order by item_pedido_id) from public.preparacion_items_pedido pi where pi.pedido_id=p.id),'[]'::jsonb)
 or i->'cantidades' is distinct from operativo_privado.cantidades_ruta_multi(p.id)
 or jsonb_typeof(i->'version') is distinct from 'number' then raise exception 'SNAPSHOT_MULTI_INVALIDO'; end if;
 if (i->>'version')::numeric<>trunc((i->>'version')::numeric)
 or (i->>'version')::numeric<f.version or (i->>'version')::numeric>coalesce(v,-1)
 or f.valores_anteriores->>'estado' is distinct from 'en_reparto'
 or f.valores_nuevos->>'estado' is distinct from 'entrega_fallida'
 or nullif(btrim(f.motivo),'') is null
 or f.valores_nuevos->>'motivo' is distinct from f.motivo
 or jsonb_typeof(i->'historial') is distinct from 'array' then raise exception 'FALLO_MULTI_NO_AUDITADO'; end if;
 if (i->'historial' @> jsonb_build_array(to_jsonb(f))) is distinct from true then raise exception 'FALLO_MULTI_NO_AUDITADO'; end if;
 select * into ef from operativo_privado.ruta_multi_eventos where clave=f.clave_idempotencia and ruta_id=r.id;
 if not found or ef.solicitud->>'accion' is distinct from 'fallida'
 or ef.solicitud->>'pedido' is distinct from p.id::text
 or ef.actor is distinct from f.actor_id or ef.solicitud->>'motivo' is distinct from f.motivo
 or ef.solicitud->>'ruta' is distinct from r.id::text
 or ef.solicitud->>'fecha' is distinct from r.fecha::text
 or (ef.resultado->'snapshot'->'pedidos' @> jsonb_build_array(jsonb_build_object('pedido',to_jsonb(p),'posicion',m.posicion,'version',f.version,'historial',jsonb_build_array(to_jsonb(f))))) is distinct from true
 or ef.solicitud->'version_pedido' is distinct from to_jsonb(f.version_esperada) then
 raise exception 'EVENTO_FALLO_MULTI_INVALIDO'; end if;
 select * into ec from operativo_privado.ruta_multi_eventos where ruta_id=r.id
 and solicitud->>'accion'='cerrar' and resultado->'snapshot'->'ruta'=to_jsonb(r);
 if not found or ec.anterior is distinct from (r.cierre-'cerrada_en'-'cerrada_por')
 or ec.resultado->'snapshot'->'pedidos' is distinct from r.cierre->'pedidos'
 or ec.actor::text is distinct from r.cierre->>'cerrada_por'
 or ec.solicitud->>'ruta' is distinct from r.id::text
 or ec.solicitud->>'fecha' is distinct from r.fecha::text
 or r.cierre->>'cerrada_en' is null or r.salida_en is null
 or ef.instante<r.salida_en or ec.instante<ef.instante or ec.resultado->'version' is distinct from to_jsonb(r.version)
 or r.cierre->'ruta' is distinct from (to_jsonb(r)||jsonb_build_object('estado','en_reparto','cierre',null,'version',r.version-1)) then
 raise exception 'EVENTO_CIERRE_MULTI_INVALIDO'; end if;
 return jsonb_build_object('fecha',r.fecha,'ruta',to_jsonb(r),'pertenencia',to_jsonb(m),
 'intento',i,'fallo',to_jsonb(f),'evento_fallo',to_jsonb(ef),'evento_cierre',to_jsonb(ec));
end; $$;

create or replace function operativo_privado.exigir_pedido_reprogramable(p_pedido_id uuid)
returns date language plpgsql stable security definer set search_path=pg_catalog
set timezone='UTC' set datestyle='ISO, YMD' as $$
begin
 if exists(select 1 from operativo_privado.ruta_multi_pedidos where pedido_id=p_pedido_id) then
 return (operativo_privado.evidencia_reprogramacion_multi(p_pedido_id)->>'fecha')::date;
 end if;
 return operativo_privado.exigir_pedido_reprogramable_legacy_multi(p_pedido_id);
end; $$;
create function operativo_privado.reprogramar_legacy_multi(
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

create or replace function public.reprogramar_no_entregado_administrativo(
 p_pedido_id uuid,p_version_esperada bigint,p_clave uuid,p_fecha date,p_motivo text
) returns jsonb language plpgsql security definer set search_path=pg_catalog
set timezone='UTC' set datestyle='ISO, YMD' as $$
declare p public.pedidos%rowtype; e jsonb; solicitud jsonb; inicio jsonb; despues jsonb; respuesta jsonb; origen date;
begin
 if auth.uid() is null or not coalesce(public.es_admin(),false) then raise exception 'NO_AUTORIZADO'; end if;
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'AISLAMIENTO_NO_COMPATIBLE'; end if;
 if p_fecha is null or not isfinite(p_fecha) or nullif(btrim(p_motivo),'') is null or length(p_motivo)>2000 then raise exception 'OPERACION_INVALIDA'; end if;
 lock table public.pedidos in exclusive mode;
 solicitud:=jsonb_build_object('fecha',p_fecha,'motivo',p_motivo,'contrato',1);
 inicio:=operativo_privado.iniciar_operacion(p_pedido_id,p_version_esperada,p_clave,'reprogramar_no_entregado',solicitud);
 if (inicio->>'reintento')::boolean then return inicio; end if;
 if not exists(select 1 from operativo_privado.ruta_multi_pedidos where pedido_id=p_pedido_id) then
 return operativo_privado.reprogramar_legacy_multi(p_pedido_id,p_version_esperada,p_clave,p_fecha,p_motivo);
 end if;
 perform pg_advisory_xact_lock(582051005);
 e:=operativo_privado.evidencia_reprogramacion_multi(p_pedido_id);
 origen:=(e->>'fecha')::date;
 perform pg_advisory_xact_lock(hashtextextended('carga:'||d::text,0)) from (select origen d union select p_fecha) fechas order by d;
 if p_fecha<=origen or p_fecha<(clock_timestamp() at time zone 'America/Santiago')::date then raise exception 'FECHA_REPROGRAMACION_INVALIDA'; end if;
 if p_fecha>(clock_timestamp() at time zone 'America/Santiago')::date+14
 or not public.fecha_entrega_disponible(p_fecha,clock_timestamp()) then raise exception 'FECHA_ENTREGA_NO_DISPONIBLE'; end if;
 if not operativo_privado.fecha_reprogramacion_admite_pedidos(p_fecha) then raise exception 'CARGA_NO_EDITABLE'; end if;
 select * into p from public.pedidos where id=p_pedido_id for update;
 despues:=to_jsonb(p)||jsonb_build_object('fecha_entrega',p_fecha,'estado','listo_despacho');
 insert into operativo_privado.permiso_reprogramacion values(p.id,txid_current(),auth.uid(),to_jsonb(p),despues,'null'::jsonb,'null'::jsonb);
 -- Se libera únicamente la pertenencia viva validada; no se toca la ruta,
 -- su versión ni snapshots/eventos. La barrera multi ya no encuentra pertenencia.
 delete from operativo_privado.ruta_multi_pedidos where pedido_id=p.id and to_jsonb(ruta_multi_pedidos)=e->'pertenencia';
 if not found then raise exception 'TRAZABILIDAD_INTENTO_INVALIDA'; end if;
 update public.pedidos set fecha_entrega=p_fecha,estado='listo_despacho' where id=p.id;
 delete from operativo_privado.permiso_reprogramacion where pedido_id=p.id;
 respuesta:=operativo_privado.completar_operacion(p.id,p_version_esperada,p_clave,'reprogramar_no_entregado',solicitud,null,p_motivo,
 jsonb_build_object('pedido',to_jsonb(p),'modelo','multi','evidencia',e),
 jsonb_build_object('pedido',(select to_jsonb(pe) from public.pedidos pe where id=p.id),'seleccion',null,'pertenencia',null),
 jsonb_build_object('pedido_id',p.id,'fecha',p_fecha,'estado','listo_despacho','incluido',false));
 if not public.fecha_entrega_disponible(p_fecha,clock_timestamp()) then raise exception 'FECHA_ENTREGA_NO_DISPONIBLE'; end if;
 return respuesta;
end; $$;
alter function operativo_privado.exigir_pedido_reprogramable_legacy_multi(uuid) owner to postgres;
revoke all on function operativo_privado.exigir_pedido_reprogramable_legacy_multi(uuid) from public,anon,authenticated,service_role;
alter function operativo_privado.evidencia_reprogramacion_multi(uuid) owner to postgres;
revoke all on function operativo_privado.evidencia_reprogramacion_multi(uuid) from public,anon,authenticated,service_role;
alter function operativo_privado.reprogramar_legacy_multi(uuid,bigint,uuid,date,text) owner to postgres;
revoke all on function operativo_privado.reprogramar_legacy_multi(uuid,bigint,uuid,date,text) from public,anon,authenticated,service_role;
-- CREATE OR REPLACE conserva OID/ACL de las RPC y del auxiliar existentes.
commit;
