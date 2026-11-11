-- FASE 2: instalación MANUAL inicial, completa y transaccional como postgres.
-- Auditoría integral estática: ver terminar_ruta_fase2_revision.md.
-- No es una migración aplicada ni un actualizador de instalaciones anteriores.
-- Mantiene barreras globales EXCLUSIVE; planificación y líneas pueden abortar
-- con 55P03. Reintentar la transacción completa con la misma solicitud/clave.
-- No se ejecutó este SQL ni se consultó una base remota.
begin;
-- Fallar sin cambios si la instalación no tiene los contratos auditados.
do $$
declare r record; firma text; rol text;
begin
 -- FORCE RLS también alcanza al propietario ordinario. Las dependencias
 -- privadas vigentes no tienen policies: SECURITY DEFINER por sí solo no basta.
 -- Exigir el ejecutor documentado y su bypass antes de cualquier cambio evita
 -- instalar RPC que luego fallen o lean un historial/versión invisible.
 if current_user <> 'postgres' or not exists (
   select 1 from pg_roles where rolname='postgres' and (rolsuper or rolbypassrls)
 ) then raise exception 'FASE2_REQUIERE_POSTGRES_CON_BYPASSRLS'; end if;
 if current_setting('transaction_isolation') <> 'read committed'
 or current_setting('session_replication_role') <> 'origin' then
 raise exception 'FASE2_REQUIERE_READ_COMMITTED_Y_TRIGGERS_ORIGIN'; end if;
 if to_regclass('operativo_privado.permiso_reprogramacion') is not null
 or to_regprocedure('public.cerrar_ruta(date,bigint,uuid,text)') is not null
 or to_regprocedure('operativo_privado.orden_ruta_dia(date,uuid[],bigint)') is not null
 or exists(select 1 from pg_attribute where attrelid=to_regclass('operativo_privado.cargas')
 and attname in ('cerrada_en','cerrada_por','resumen_cierre') and not attisdropped) then
 raise exception 'FASE2_YA_INSTALADA_O_PARCIAL'; end if;
 if to_regprocedure('public.confirmar_entrega_todo_correcto(uuid,bigint,uuid,jsonb,jsonb)') is null
 or to_regprocedure('public.confirmar_entrega_hubo_diferencias(uuid,bigint,uuid,jsonb,jsonb)') is null
 or to_regprocedure('public.registrar_entrega_fallida(uuid,bigint,uuid,text,text)') is null
 or to_regprocedure('public.orden_ruta_dia(date,uuid[],bigint)') is null
 or to_regprocedure('public.operar_carga_jornada(date,bigint,uuid,text,jsonb,text)') is null
 or to_regprocedure('operativo_privado.proteger_entrega_fallida()') is null
 or to_regprocedure('operativo_privado.iniciar_operacion(uuid,bigint,uuid,text,jsonb)') is null
 or to_regprocedure('operativo_privado.completar_operacion(uuid,bigint,uuid,text,jsonb,uuid,text,jsonb,jsonb,jsonb)') is null then
 raise exception 'DEPENDENCIAS_FASE2_INCOMPLETAS'; end if;
 if not exists(select 1 from pg_trigger where tgrelid='public.pedidos'::regclass
 and tgfoid='operativo_privado.proteger_entrega_fallida()'::regprocedure
 and not tgisinternal and tgenabled in ('O','A')) then
 raise exception 'BARRERA_ENTREGA_FALLIDA_NO_INSTALADA'; end if;
 -- Contrato real de columnas: preparacion_items_pedido SÍ tiene pedido_id.
 -- No se infiere un esquema alternativo ni se instala sobre tablas incompletas.
 for r in select * from (values
 ('public.pedidos','id','uuid'), ('public.pedidos','estado','public.estado_pedido'),
 ('public.pedidos','fecha_entrega','date'), ('public.pedidos','numero_pedido','text'),
 ('public.pedidos','nombre_cliente_snapshot','text'),
 ('public.pedidos','fecha_actualizacion','timestamptz'),
 ('public.pedidos','preparacion_finalizada_en','timestamptz'),
 ('public.pedidos','regimen_contable','text'),
 ('public.pedidos','venta_definitiva_snapshot','jsonb'),
 ('public.pedidos','venta_reconocida_en','timestamptz'),
 ('public.items_pedido','id','uuid'), ('public.items_pedido','pedido_id','uuid'),
 ('public.items_pedido','nombre_producto_snapshot','text'),
 ('public.preparacion_items_pedido','pedido_id','uuid'),
 ('public.preparacion_items_pedido','item_pedido_id','uuid'),
 ('public.preparacion_items_pedido','cantidad_preparada','numeric'),
 ('public.preparacion_items_pedido','importe_linea_operativo','bigint'),
 ('public.preparacion_items_pedido','confirmado_explicito','boolean'),
 ('operativo_privado.cargas','fecha','date'), ('operativo_privado.cargas','estado','text'),
 ('operativo_privado.cargas','version','bigint'),
 ('operativo_privado.cargas','salida_en','timestamptz'),
 ('operativo_privado.carga_pedidos','fecha','date'),
 ('operativo_privado.carga_pedidos','pedido_id','uuid'),
 ('operativo_privado.carga_pedidos','incluido','boolean'),
 ('operativo_privado.carga_pedidos','motivo','text'),
 ('operativo_privado.versiones_pedido','pedido_id','uuid'),
 ('operativo_privado.versiones_pedido','version','bigint'),
 ('operativo_privado.historial_operativo','pedido_id','uuid'),
 ('operativo_privado.historial_operativo','version','bigint'),
 ('operativo_privado.historial_operativo','operacion','text'),
 ('operativo_privado.historial_operativo','actor_id','uuid'),
 ('operativo_privado.historial_operativo','motivo','text'),
 ('operativo_privado.historial_operativo','valores_anteriores','jsonb'),
 ('operativo_privado.historial_operativo','valores_nuevos','jsonb'),
 ('operativo_privado.historial_cargas','fecha','date'),
 ('operativo_privado.historial_cargas','version','bigint'),
 ('operativo_privado.historial_cargas','clave','uuid'),
 ('operativo_privado.historial_cargas','actor','uuid'),
 ('operativo_privado.historial_cargas','solicitud','jsonb'),
 ('operativo_privado.historial_cargas','anterior','jsonb'),
 ('operativo_privado.historial_cargas','resultado','jsonb'),
 ('operativo_privado.entregas_definitivas','pedido_id','uuid'),
 ('operativo_privado.entregas_definitivas','snapshot','jsonb'),
 ('operativo_privado.entregas_definitivas','instante','timestamptz'),
 ('public.rutas','id','uuid'), ('public.rutas','fecha_operativa','date'),
 ('public.paradas_ruta','ruta_id','uuid'),
 ('operativo_privado.historial_operativo','clave_idempotencia','uuid'),
 ('operativo_privado.historial_operativo','version_esperada','bigint'),
 ('operativo_privado.historial_operativo','solicitud','jsonb'),
 ('operativo_privado.historial_operativo','resultado','jsonb')
 ) v(tabla,columna,tipo) loop
 if not exists(select 1 from pg_attribute a join pg_class c on c.oid=a.attrelid
 where a.attrelid=to_regclass(r.tabla) and c.relkind='r'
 and a.attname=r.columna and a.atttypid=to_regtype(r.tipo)
 and a.attnum>0 and not a.attisdropped) then
 raise exception 'CONTRATO_COLUMNA_FASE2_INVALIDO: %.% (%)',r.tabla,r.columna,r.tipo;
 end if;
 end loop;
 for firma in select unnest(array[
 'public.es_admin()', 'auth.uid()', 'public.leer_carga_jornada(date)',
 'public.obtener_o_crear_ruta_administrativa(date)',
 'operativo_privado.proteger_pedido_cargado()',
 'operativo_privado.proteger_venta_definitiva()',
 'public.proteger_regimen_contable_pedido()',
 'public.registrar_historial_estado_pedido()',
 'public.validar_coherencia_preparacion_item_pedido()',
 'operativo_privado.impedir_mutacion_historial()'
 ]) loop
 if to_regprocedure(firma) is null then
 raise exception 'FUNCION_FASE2_AUSENTE: %',firma; end if;
 end loop;
 for r in select * from (values
 ('public.pedidos','proteger_pedido_cargado','operativo_privado.proteger_pedido_cargado()'),
 ('public.pedidos','proteger_venta_definitiva','operativo_privado.proteger_venta_definitiva()'),
 ('public.pedidos','proteger_regimen_contable_pedido_antes_de_actualizar','public.proteger_regimen_contable_pedido()'),
 ('public.pedidos','registrar_historial_estado_pedido_despues_de_guardar','public.registrar_historial_estado_pedido()'),
 ('public.preparacion_items_pedido','validar_coherencia_preparacion_item_pedido_antes_de_guardar','public.validar_coherencia_preparacion_item_pedido()'),
 ('operativo_privado.historial_operativo','historial_operativo_inmutable','operativo_privado.impedir_mutacion_historial()'),
 ('operativo_privado.historial_operativo','historial_operativo_no_truncable','operativo_privado.impedir_mutacion_historial()'),
 ('operativo_privado.historial_cargas','historial_cargas_inmutable','operativo_privado.impedir_mutacion_historial()'),
 ('operativo_privado.historial_cargas','historial_cargas_no_truncable','operativo_privado.impedir_mutacion_historial()'),
 ('operativo_privado.entregas_definitivas','entregas_definitivas_inmutables','operativo_privado.impedir_mutacion_historial()'),
 ('operativo_privado.entregas_definitivas','entregas_definitivas_no_truncables','operativo_privado.impedir_mutacion_historial()')
 ) v(tabla,nombre,funcion) loop
 if not exists(select 1 from pg_trigger where tgrelid=to_regclass(r.tabla)
 and tgname=r.nombre and tgfoid=to_regprocedure(r.funcion)
 and not tgisinternal and tgenabled in ('O','A')) then
 raise exception 'TRIGGER_FASE2_INVALIDO: %.%',r.tabla,r.nombre; end if;
 end loop;
 -- Claves que sostienen unicidad, ON CONFLICT, versiones y reintentos.
 for r in select * from (values
 ('public.pedidos',array['id']), ('public.items_pedido',array['id']),
 ('public.preparacion_items_pedido',array['item_pedido_id']),
 ('operativo_privado.cargas',array['fecha']),
 ('operativo_privado.carga_pedidos',array['pedido_id']),
 ('operativo_privado.versiones_pedido',array['pedido_id']),
 ('operativo_privado.entregas_definitivas',array['pedido_id']),
 ('operativo_privado.historial_cargas',array['fecha','version']),
 ('operativo_privado.historial_cargas',array['fecha','clave']),
 ('operativo_privado.historial_operativo',array['pedido_id','version']),
 ('operativo_privado.historial_operativo',array['pedido_id','clave_idempotencia'])
 ) v(tabla,columnas) loop
 if not exists(select 1 from pg_constraint c
 join pg_index ix on ix.indexrelid=c.conindid
 where c.conrelid=to_regclass(r.tabla) and c.contype in ('p','u')
 and not c.condeferrable and c.convalidated and ix.indisvalid and ix.indisready
 and array(select a.attname::text from unnest(c.conkey) with ordinality k(num,ord)
 join pg_attribute a on a.attrelid=c.conrelid and a.attnum=k.num order by k.ord)=r.columnas) then
 raise exception 'CLAVE_FASE2_INVALIDA: % (%)',r.tabla,r.columnas; end if;
 end loop;
 -- Los auxiliares no elevan privilegios por sí mismos; las RPC sí lo hacen.
 for r in select * from (values
 ('operativo_privado.iniciar_operacion(uuid,bigint,uuid,text,jsonb)',false),
 ('operativo_privado.completar_operacion(uuid,bigint,uuid,text,jsonb,uuid,text,jsonb,jsonb,jsonb)',false),
 ('public.operar_carga_jornada(date,bigint,uuid,text,jsonb,text)',true),
 ('public.orden_ruta_dia(date,uuid[],bigint)',true),
 ('public.confirmar_entrega_todo_correcto(uuid,bigint,uuid,jsonb,jsonb)',true),
 ('public.confirmar_entrega_hubo_diferencias(uuid,bigint,uuid,jsonb,jsonb)',true),
 ('public.registrar_entrega_fallida(uuid,bigint,uuid,text,text)',true)
 ) v(firma,definidor) loop
 if not exists(select 1 from pg_proc where oid=to_regprocedure(r.firma)
 and proowner='postgres'::regrole and prosecdef=r.definidor
 and prorettype='jsonb'::regtype and not proretset and provolatile='v') then
 raise exception 'CONTRATO_FUNCION_FASE2_INVALIDO: %',r.firma; end if;
 end loop;
 -- Evita instalar elevación de privilegios sobre un esquema escribible por API.
 foreach rol in array array['anon','authenticated','service_role'] loop
 if has_schema_privilege(rol,'operativo_privado','USAGE')
 or has_schema_privilege(rol,'operativo_privado','CREATE')
 or has_schema_privilege(rol,'public','CREATE') then
 raise exception 'ESQUEMA_FASE2_NO_AISLADO: %',rol; end if;
 for r in select c.oid,c.relname,c.relrowsecurity from pg_class c
 where c.oid in ('public.pedidos'::regclass,'public.items_pedido'::regclass,
 'public.preparacion_items_pedido'::regclass) loop
 if not r.relrowsecurity or has_table_privilege(rol,r.oid,'INSERT,UPDATE,DELETE,TRUNCATE')
 or has_any_column_privilege(rol,r.oid,'INSERT,UPDATE') then
 raise exception 'DML_PUBLICO_FASE2_NO_CERRADO: % (%)',r.relname,rol; end if;
 end loop;
 for r in select c.oid,c.relname,c.relrowsecurity,c.relforcerowsecurity
 from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='operativo_privado' and c.relkind='r'
 and c.relname in ('cargas','carga_pedidos','historial_cargas','versiones_pedido','historial_operativo','entregas_definitivas') loop
 if not r.relrowsecurity or not r.relforcerowsecurity
 or has_table_privilege(rol,r.oid,'INSERT,UPDATE,DELETE,TRUNCATE')
 or has_any_column_privilege(rol,r.oid,'INSERT,UPDATE') then
 raise exception 'TABLA_PRIVADA_FASE2_NO_AISLADA: % (%)',r.relname,rol; end if;
 end loop;
 end loop;
 if exists(select 1 from unnest(array['listo_despacho','en_reparto','entregado','entrega_fallida']) e
 where not exists(select 1 from pg_enum where enumtypid='public.estado_pedido'::regtype and enumlabel=e)) then
 raise exception 'ESTADOS_FASE2_INCOMPLETOS'; end if;
end $$;
-- Instalación en ventana sin escritores: NOWAIT aborta en lugar de formar
-- ciclos DDL con RPC que ya retengan filas de pedidos/rutas/líneas.
lock table public.pedidos, public.items_pedido, public.preparacion_items_pedido,
 public.rutas, public.paradas_ruta, operativo_privado.cargas,
 operativo_privado.carga_pedidos, operativo_privado.historial_cargas,
 operativo_privado.versiones_pedido, operativo_privado.historial_operativo,
 operativo_privado.entregas_definitivas in access exclusive mode nowait;
do $$ begin
 if exists(select 1 from public.preparacion_items_pedido pi
 left join public.items_pedido i on i.id=pi.item_pedido_id
 where i.id is null or pi.pedido_id is distinct from i.pedido_id) then
 raise exception 'PREPARACION_INCOHERENTE_PREEXISTENTE'; end if;
end $$;
alter table operativo_privado.cargas drop constraint cargas_estado_check;
alter table operativo_privado.cargas add constraint cargas_estado_check
 check (estado in ('preparacion','lista','en_ruta','cerrada'));
alter table operativo_privado.cargas add column cerrada_en timestamptz,
 add column cerrada_por uuid, add column resumen_cierre jsonb;
alter table operativo_privado.cargas add constraint cierre_completo check (
 (estado='cerrada' and cerrada_en is not null and cerrada_por is not null and resumen_cierre is not null)
 or (estado<>'cerrada' and cerrada_en is null and cerrada_por is null and resumen_cierre is null));

-- Mantiene el lector vigente y expone la salida real para habilitar el botón.
create or replace function public.leer_carga_jornada(p_fecha date)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog set timezone='UTC' set datestyle='ISO, YMD' as $$
declare c operativo_privado.cargas%rowtype;
begin
 if auth.uid() is null or not coalesce(public.es_admin(),false) then raise exception 'NO_AUTORIZADO'; end if;
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
 'estado',p.estado,'incluido',cp.incluido,'motivo',cp.motivo,
 'productos',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'nombre',i.nombre_producto_snapshot,
 'cantidad',pi.cantidad_preparada,'importe',pi.importe_linea_operativo,'confirmado',coalesce(pi.confirmado_explicito,false)) order by i.id)
 from public.items_pedido i left join public.preparacion_items_pedido pi on pi.item_pedido_id=i.id where i.pedido_id=p.id),'[]'::jsonb),'pendientes',
 (select count(*) from public.items_pedido i left join public.preparacion_items_pedido pi on pi.item_pedido_id=i.id
 where i.pedido_id=p.id and (not coalesce(pi.confirmado_explicito,false) or pi.importe_linea_operativo is null))) order by p.numero_pedido)
 from public.pedidos p left join operativo_privado.carga_pedidos cp on cp.pedido_id=p.id and cp.fecha=p_fecha
 where p.fecha_entrega=p_fecha or cp.fecha=p_fecha),'[]'::jsonb),
 'historial',coalesce((select jsonb_agg(to_jsonb(h) order by h.version desc) from operativo_privado.historial_cargas h where h.fecha=p_fecha),'[]'::jsonb));
end; $$;


-- Una única consulta da un snapshot coherente; captura también cambios legacy
-- que no incrementan versiones_pedido. Nunca incluye pedidos sólo por fecha.
create function operativo_privado.snapshot_cierre(p_fecha date) returns jsonb
language sql volatile security definer set search_path=pg_catalog set timezone='UTC' set datestyle='ISO, YMD' as $$
 select coalesce(jsonb_agg(jsonb_build_object('pedido',to_jsonb(p),
 'version',coalesce(v.version,0), 'seleccion',to_jsonb(cp),
 'items',coalesce((select jsonb_agg(to_jsonb(i) order by i.id)
 from public.items_pedido i where i.pedido_id=p.id),'[]'::jsonb),
 'preparacion',coalesce((select jsonb_agg(to_jsonb(pi) order by pi.item_pedido_id)
 from public.preparacion_items_pedido pi where pi.pedido_id=p.id),'[]'::jsonb),
 'fallo',(select to_jsonb(h) from operativo_privado.historial_operativo h
 where h.pedido_id=p.id and h.operacion='entrega_fallida'
 and p.estado='entrega_fallida' order by h.version desc limit 1),
 'motivo',(
 select h.motivo from operativo_privado.historial_operativo h
 where h.pedido_id=p.id and h.operacion='entrega_fallida'
 and p.estado='entrega_fallida' order by h.version desc limit 1
 )) order by p.id),'[]'::jsonb)
 from operativo_privado.carga_pedidos cp join public.pedidos p on p.id=cp.pedido_id
 left join operativo_privado.versiones_pedido v on v.pedido_id=p.id
 where cp.fecha=p_fecha and cp.incluido;
$$;
create function public.revisar_cierre_ruta(p_fecha date) returns jsonb
language plpgsql security definer set search_path=pg_catalog set timezone='UTC' set datestyle='ISO, YMD' as $$
declare c operativo_privado.cargas%rowtype; s jsonb;
begin
 if auth.uid() is null or not coalesce(public.es_admin(),false) then raise exception 'NO_AUTORIZADO'; end if;
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'AISLAMIENTO_NO_COMPATIBLE'; end if;
 if p_fecha is null or not isfinite(p_fecha) then raise exception 'OPERACION_INVALIDA'; end if;
 -- EXCLUSIVE también en revisión: SHARE podía interbloquear con SELECT FOR
 -- UPDATE seguido de UPDATE de una entrega. Mantener hasta migrar RPC de carga.
 lock table public.pedidos in exclusive mode;
 perform pg_advisory_xact_lock(hashtextextended('carga:'||p_fecha::text,0));
 select * into c from operativo_privado.cargas where fecha=p_fecha;
 if c.estado='cerrada' then return c.resumen_cierre; end if;
 if c.estado is distinct from 'en_ruta' or c.salida_en is null then raise exception 'CARGA_NO_SALIO'; end if;
 s:=operativo_privado.snapshot_cierre(p_fecha);
 return jsonb_build_object('fecha',p_fecha,'estado',c.estado,'version',c.version,'huella',encode(sha256(convert_to(s::text,'UTF8')),'hex'),
 'pedidos',coalesce((select jsonb_agg(jsonb_build_object(
 'id',x->'pedido'->>'id','numero',x->'pedido'->>'numero_pedido',
 'cliente',x->'pedido'->>'nombre_cliente_snapshot','estado',x->'pedido'->>'estado',
 'version',x->'version','motivo',x->'motivo') order by x->'pedido'->>'id')
 from jsonb_array_elements(s) x),'[]'::jsonb));
end; $$;
create function public.cerrar_ruta(p_fecha date,p_version bigint,p_clave uuid,p_huella text)
returns jsonb language plpgsql security definer set search_path=pg_catalog set timezone='UTC' set datestyle='ISO, YMD' as $$
declare c operativo_privado.cargas%rowtype; h operativo_privado.historial_cargas%rowtype;
 s jsonb; solicitud jsonb; resumen jsonb; instante timestamptz;
begin
 if auth.uid() is null or not coalesce(public.es_admin(),false) then raise exception 'NO_AUTORIZADO'; end if;
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'AISLAMIENTO_NO_COMPATIBLE'; end if;
 if p_fecha is null or not isfinite(p_fecha) or p_version is null or p_version<0 or p_clave is null
 or p_huella is null or p_huella !~ '^[0-9a-f]{64}$' then raise exception 'OPERACION_INVALIDA'; end if;
 -- EXCLUSIVE espera también SELECT FOR UPDATE y toda escritura de entregas.
 -- No bloquea clientes ni toma locks en orden inverso a las RPC contables.
 lock table public.pedidos in exclusive mode;
 perform pg_advisory_xact_lock(hashtextextended('carga:'||p_fecha::text,0));
 solicitud:=jsonb_build_object('accion','cerrar','version',p_version,'huella',p_huella);
 select * into h from operativo_privado.historial_cargas where fecha=p_fecha and clave=p_clave;
 if found then
 if h.actor is distinct from auth.uid() or h.solicitud is distinct from solicitud then raise exception 'CLAVE_IDEMPOTENCIA_EN_USO'; end if;
 return h.resultado;
 end if;
 select * into c from operativo_privado.cargas where fecha=p_fecha for update;
 if c.estado is distinct from 'en_ruta' or c.salida_en is null then raise exception 'CARGA_NO_SALIO'; end if;
 if c.version<>p_version then raise exception 'VERSION_CARGA_CONFLICTO'; end if;
 s:=operativo_privado.snapshot_cierre(p_fecha);
 if encode(sha256(convert_to(s::text,'UTF8')),'hex')<>p_huella then raise exception 'RESUMEN_CIERRE_CONFLICTO'; end if;
 if jsonb_array_length(s)=0 then raise exception 'CARGA_VACIA'; end if;
 if exists(select 1 from jsonb_array_elements(s) x where coalesce(x->'pedido'->>'estado','') not in ('entregado','entrega_fallida')) then
 raise exception 'PEDIDOS_PENDIENTES'; end if;
 -- No cerrar un intento inconsistente ni convertir un fallo en una venta.
 if exists(select 1 from jsonb_array_elements(s) x
 where x->'pedido'->>'fecha_entrega' is distinct from p_fecha::text
 or (x->'pedido'->>'estado'='entrega_fallida' and (
 jsonb_typeof(x->'fallo') is distinct from 'object'
 or x->'fallo'->'valores_anteriores'->>'estado' is distinct from 'en_reparto'
 or x->'fallo'->'valores_nuevos'->>'estado' is distinct from 'entrega_fallida'
 or (x->'fallo'->>'version')::bigint>(x->>'version')::bigint
 or x->'pedido'->'venta_definitiva_snapshot' is distinct from 'null'::jsonb
 or x->'pedido'->'venta_reconocida_en' is distinct from 'null'::jsonb
 or exists(select 1 from operativo_privado.entregas_definitivas e
 where e.pedido_id=(x->'pedido'->>'id')::uuid)))
 or (x->'pedido'->>'estado'='entregado' and x->'pedido'->>'regimen_contable'='entrega_v1'
 and not exists(select 1 from operativo_privado.entregas_definitivas e
 where e.pedido_id=(x->'pedido'->>'id')::uuid
 and e.snapshot=x->'pedido'->'venta_definitiva_snapshot'
 and e.instante=(x->'pedido'->>'venta_reconocida_en')::timestamptz))) then
 raise exception 'TRAZABILIDAD_INTENTO_INVALIDA'; end if;
 resumen:=public.revisar_cierre_ruta(p_fecha);
 instante:=clock_timestamp();
 resumen:=resumen || jsonb_build_object('estado','cerrada','version',c.version+1,
 -- Evidencia del intento y lectura de carga congeladas antes de cambiar estado.
 -- carga_pedidos conserva sólo la asignación vigente, no es tabla de intentos.
 'intentos',s,'pedidos_carga',public.leer_carga_jornada(p_fecha)->'pedidos',
 'cerrada_en',instante,'cerrada_por',auth.uid(),
 'entregados',(select count(*) from jsonb_array_elements(s) x where x->'pedido'->>'estado'='entregado'),
 'no_entregados',(select count(*) from jsonb_array_elements(s) x where x->'pedido'->>'estado'='entrega_fallida'),'pendientes',0);
 update operativo_privado.cargas set estado='cerrada',version=version+1,
 cerrada_en=instante,cerrada_por=auth.uid(),resumen_cierre=resumen where fecha=p_fecha;
 insert into operativo_privado.historial_cargas(fecha,version,clave,actor,solicitud,anterior,resultado)
 values(p_fecha,c.version+1,p_clave,auth.uid(),solicitud,to_jsonb(c),resumen);
 -- Ninguna escritura contable ni de pedidos: legado conserva íntegros sus saldos.
 return resumen;
end; $$;

-- Capacidad efímera, no GUC falsificable. Sólo postgres puede escribirla.
-- Autoriza exactamente dos UPDATE de una RPC, en la misma transacción/actor.
create table operativo_privado.permiso_reprogramacion (
 pedido_id uuid primary key, transaccion bigint not null, actor uuid not null,
 pedido_antes jsonb not null, pedido_despues jsonb not null,
 seleccion_antes jsonb not null, seleccion_despues jsonb not null
);
alter table operativo_privado.permiso_reprogramacion owner to postgres;
alter table operativo_privado.permiso_reprogramacion enable row level security;
alter table operativo_privado.permiso_reprogramacion force row level security;
revoke all on operativo_privado.permiso_reprogramacion from public,anon,authenticated,service_role;
-- Acceso explícito del propietario efectivo de la RPC y del verificador.
-- No otorga ACL ni acceso a los roles API; FORCE RLS permanece habilitado.
create policy permiso_reprogramacion_propietario
 on operativo_privado.permiso_reprogramacion for all to postgres
 using (true) with check (true);
create function operativo_privado.permite_reprogramacion(p_tabla oid,p_antes jsonb,p_despues jsonb)
returns boolean language plpgsql security definer set search_path=pg_catalog set timezone='UTC' set datestyle='ISO, YMD' as $$
declare r operativo_privado.permiso_reprogramacion%rowtype; omitidas text[];
begin
 select * into r from operativo_privado.permiso_reprogramacion
 where pedido_id=coalesce(p_antes->>'pedido_id',p_antes->>'id')::uuid
 and transaccion=txid_current() and actor=auth.uid();
 if not found or auth.uid() is null or not coalesce(public.es_admin(),false) then return false; end if;
 if p_tabla='public.pedidos'::regclass then
 select array['fecha_actualizacion']::text[] || coalesce(array_agg(attname::text),array[]::text[])
 into omitidas from pg_attribute where attrelid=p_tabla and attnum>0 and not attisdropped and attgenerated<>'';
 return (p_antes-omitidas)=(r.pedido_antes-omitidas)
 and (p_despues-omitidas)=(r.pedido_despues-omitidas);
 elsif p_tabla='operativo_privado.carga_pedidos'::regclass then
 return p_antes=r.seleccion_antes and p_despues=r.seleccion_despues;
 end if;
 return false;
end; $$;
alter function operativo_privado.permite_reprogramacion(oid,jsonb,jsonb) owner to postgres;
revoke all on function operativo_privado.permite_reprogramacion(oid,jsonb,jsonb) from public,anon,authenticated,service_role;

-- La carga cerrada es inmutable. Sólo la capacidad exacta permite trasladar
-- una selección fallida; el resumen cerrado y ambos historiales se conservan.
create function operativo_privado.proteger_cierre_carga() returns trigger
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
 if TG_OP='UPDATE' and operativo_privado.permite_reprogramacion(TG_RELID,to_jsonb(old),to_jsonb(new)) then return new; end if;
 if exists(select 1 from operativo_privado.cargas where estado='cerrada'
 and (fecha=case when TG_OP='INSERT' then new.fecha else old.fecha end
 or fecha=case when TG_OP='DELETE' then old.fecha else new.fecha end)) then raise exception 'RUTA_CERRADA'; end if;
 end if;
 if TG_OP='DELETE' then return old; end if;
 return new;
end; $$;
create trigger proteger_cierre_carga before update or delete on operativo_privado.cargas
 for each row execute function operativo_privado.proteger_cierre_carga();
create trigger proteger_cierre_seleccion before insert or update or delete on operativo_privado.carga_pedidos
 for each row execute function operativo_privado.proteger_cierre_carga();

-- Todo UPDATE/DELETE directo de un pedido cerrado queda bloqueado. Las entregas
-- vigentes escriben pedidos dentro de su transacción: cualquier evento/pago
-- previo al UPDATE se revierte junto. Reintentos ya confirmados siguen válidos.
create function operativo_privado.proteger_pedido_ruta_cerrada() returns trigger
language plpgsql security definer set search_path=pg_catalog set timezone='UTC' set datestyle='ISO, YMD' as $$
begin
 -- Una snapshot REPEATABLE READ anterior al cierre podría ocultarlo en triggers.
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'AISLAMIENTO_NO_COMPATIBLE'; end if;
 if TG_OP='UPDATE' and operativo_privado.permite_reprogramacion(TG_RELID,to_jsonb(old),to_jsonb(new)) then return new; end if;
 if exists(select 1 from operativo_privado.carga_pedidos cp join operativo_privado.cargas c using(fecha)
 where cp.pedido_id=old.id and cp.incluido and c.estado='cerrada') then raise exception 'RUTA_CERRADA'; end if;
 if TG_OP='DELETE' then return old; end if;
 return new;
end; $$;
create trigger proteger_pedido_ruta_cerrada before update or delete on public.pedidos
 for each row execute function operativo_privado.proteger_pedido_ruta_cerrada();

-- Las líneas de carga/preparación tampoco pueden mutar después del cierre.
-- Bloquear el padre antes de comprobar evita una lectura anterior al cierre.
create function operativo_privado.proteger_linea_ruta_cerrada() returns trigger
language plpgsql security definer set search_path=pg_catalog set timezone='UTC' set datestyle='ISO, YMD' as $$
declare anterior uuid; siguiente uuid; padres uuid[] := array[]::uuid[];
begin
 -- Una snapshot REPEATABLE READ anterior al cierre podría ocultarlo en triggers.
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'AISLAMIENTO_NO_COMPATIBLE'; end if;
 if TG_OP<>'INSERT' then anterior:=old.pedido_id; end if;
 if TG_OP<>'DELETE' then siguiente:=new.pedido_id; end if;
 padres:=array[anterior,siguiente];
 if TG_RELID='public.preparacion_items_pedido'::regclass then
 -- Proteger tanto la FK redundante como el padre real del ítem OLD y NEW.
 select padres || coalesce(array_agg(i.pedido_id),array[]::uuid[]) into padres
 from public.items_pedido i where i.id in (
 case when TG_OP<>'INSERT' then old.item_pedido_id end,
 case when TG_OP<>'DELETE' then new.item_pedido_id end);
 end if;
 -- Un BEFORE de línea puede tener ya bloqueada la fila hija. Nunca esperar
 -- al padre de una entrega que a su vez necesita esa línea.
 perform 1 from public.pedidos where id=any(padres) order by id for update nowait;
 -- Comprobar después del lock: una preparación pudo insertarse entre la
 -- lectura inicial de la línea y la adquisición de sus padres.
 if TG_RELID='public.items_pedido'::regclass and TG_OP='UPDATE' then
 if exists(select 1 from public.preparacion_items_pedido pi
 where pi.item_pedido_id=old.id and pi.pedido_id is distinct from new.pedido_id) then
 raise exception 'ITEM_PEDIDO_NO_CORRESPONDE_AL_PEDIDO'; end if;
 end if;
 if exists(select 1 from operativo_privado.carga_pedidos cp join operativo_privado.cargas c using(fecha)
 where cp.pedido_id=any(padres) and cp.incluido and c.estado='cerrada') then raise exception 'RUTA_CERRADA'; end if;
 if TG_OP='DELETE' then return old; end if;
 return new;
end; $$;
create trigger proteger_items_ruta_cerrada before insert or update or delete on public.items_pedido
 for each row execute function operativo_privado.proteger_linea_ruta_cerrada();
create trigger proteger_preparacion_ruta_cerrada before insert or update or delete on public.preparacion_items_pedido
 for each row execute function operativo_privado.proteger_linea_ruta_cerrada();
alter function operativo_privado.proteger_linea_ruta_cerrada() owner to postgres;
revoke all on function operativo_privado.proteger_linea_ruta_cerrada() from public,anon,authenticated,service_role;

-- Barrera de tablas para cualquier RPC de planificación, además del wrapper.
-- EXCLUSIVE NOWAIT también es incompatible con ROW SHARE de SELECT FOR UPDATE:
-- SHARE NOWAIT no bastaba, pues permitía retener filas de una entrega que luego
-- esperaba ROW EXCLUSIVE. Si ya hay locks incompatibles, aborta sin esperar con
-- filas de rutas/paradas retenidas. Reintentar toda la transacción ante 55P03.
create function operativo_privado.proteger_orden_ruta_cerrada() returns trigger
language plpgsql security definer set search_path=pg_catalog set timezone='UTC' set datestyle='ISO, YMD' as $$
declare anterior uuid; siguiente uuid;
begin
 -- Una snapshot REPEATABLE READ anterior al cierre podría ocultarlo en triggers.
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'AISLAMIENTO_NO_COMPATIBLE'; end if;
 lock table public.pedidos in exclusive mode nowait;
 if TG_TABLE_NAME='rutas' then
 if exists(select 1 from operativo_privado.cargas c where c.estado='cerrada'
 and (c.fecha=case when TG_OP='INSERT' then new.fecha_operativa else old.fecha_operativa end
 or c.fecha=case when TG_OP='DELETE' then old.fecha_operativa else new.fecha_operativa end)) then raise exception 'RUTA_CERRADA'; end if;
 else
 if TG_OP<>'INSERT' then anterior:=old.ruta_id; end if;
 if TG_OP<>'DELETE' then siguiente:=new.ruta_id; end if;
 if exists(select 1 from public.rutas r join operativo_privado.cargas c on c.fecha=r.fecha_operativa
 where r.id in (anterior,siguiente) and c.estado='cerrada') then raise exception 'RUTA_CERRADA'; end if;
 end if;
 if TG_OP='DELETE' then return old; end if;
 return new;
end; $$;
create trigger proteger_orden_cerrado before insert or update or delete on public.paradas_ruta
 for each row execute function operativo_privado.proteger_orden_ruta_cerrada();
create trigger proteger_ruta_cerrada before insert or update or delete on public.rutas
 for each row execute function operativo_privado.proteger_orden_ruta_cerrada();

-- Encapsula la RPC vigente sin duplicar su implementación ni dejar bypass API.
alter function public.orden_ruta_dia(date,uuid[],bigint) set schema operativo_privado;
alter function operativo_privado.orden_ruta_dia(date,uuid[],bigint) set search_path=pg_catalog;
revoke all on function operativo_privado.orden_ruta_dia(date,uuid[],bigint) from public,anon,authenticated,service_role;
create function public.orden_ruta_dia(p_fecha date,p_orden uuid[] default null,p_version bigint default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog set timezone='UTC' set datestyle='ISO, YMD' as $$
begin
 if auth.uid() is null or not coalesce(public.es_admin(),false) then raise exception 'NO_AUTORIZADO'; end if;
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'AISLAMIENTO_NO_COMPATIBLE'; end if;
 if p_fecha is null or not isfinite(p_fecha) then raise exception 'OPERACION_INVALIDA'; end if;
 if p_orden is not null then
 -- Antes del advisory de ruta y de cualquier FOR SHARE de la implementación.
 -- Una entrega previa retiene ROW SHARE: NOWAIT aborta; una posterior espera
 -- al adquirir ROW SHARE, antes de bloquear filas. No hay conversión circular.
 lock table public.pedidos in exclusive mode nowait;
 if exists(select 1 from operativo_privado.cargas where fecha=p_fecha and estado='cerrada') then raise exception 'RUTA_CERRADA'; end if;
 end if;
 return operativo_privado.orden_ruta_dia(p_fecha,p_orden,p_version);
end; $$;

create or replace function operativo_privado.proteger_entrega_fallida()
returns trigger language plpgsql security definer set search_path=pg_catalog set timezone='UTC' set datestyle='ISO, YMD' as $$
begin
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

alter function operativo_privado.proteger_entrega_fallida() owner to postgres;
revoke all on function operativo_privado.proteger_entrega_fallida() from public,anon,authenticated,service_role;

-- Reprograma únicamente fallidas incluidas en una carga cerrada. Conserva
-- preparación, precios, saldos y cierre original; la nueva carga debe decidir
-- su inclusión explícitamente. No acepta un patch genérico del pedido.
create function public.reprogramar_no_entregado_administrativo(
 p_pedido_id uuid,p_version_esperada bigint,p_clave uuid,p_fecha date,p_motivo text
) returns jsonb language plpgsql security definer set search_path=pg_catalog set timezone='UTC' set datestyle='ISO, YMD' as $$
declare p public.pedidos%rowtype; cp operativo_privado.carga_pedidos%rowtype;
 c operativo_privado.cargas%rowtype; destino operativo_privado.cargas%rowtype;
 solicitud jsonb; inicio jsonb; despues jsonb; seleccion jsonb; respuesta jsonb;
 intento jsonb; fallo operativo_privado.historial_operativo%rowtype;
begin
 if auth.uid() is null or not coalesce(public.es_admin(),false) then raise exception 'NO_AUTORIZADO'; end if;
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'AISLAMIENTO_NO_COMPATIBLE'; end if;
 if p_fecha is null or not isfinite(p_fecha) or nullif(btrim(p_motivo),'') is null or length(p_motivo)>2000 then raise exception 'OPERACION_INVALIDA'; end if;
 -- Mismo orden global que operar/cerrar; no se toman locks de cliente ni dinero.
 lock table public.pedidos in exclusive mode;
 solicitud:=jsonb_build_object('fecha',p_fecha,'motivo',p_motivo,'contrato',1);
 inicio:=operativo_privado.iniciar_operacion(p_pedido_id,p_version_esperada,p_clave,'reprogramar_no_entregado',solicitud);
 if (inicio->>'reintento')::boolean then return inicio; end if;
 select * into p from public.pedidos where id=p_pedido_id;
 select * into cp from operativo_privado.carga_pedidos where pedido_id=p.id;
 if not found or not cp.incluido then raise exception 'PEDIDO_NO_REPROGRAMABLE'; end if;
 if p_fecha<=cp.fecha or p_fecha<(clock_timestamp() at time zone 'America/Santiago')::date then raise exception 'FECHA_REPROGRAMACION_INVALIDA'; end if;
 -- Locks advisory en orden de fecha, antes de las filas de carga.
 perform pg_advisory_xact_lock(hashtextextended('carga:'||d::text,0))
 from (select cp.fecha d union select p_fecha) fechas order by d;
 -- Igual que operar_carga_jornada: materializar destino tras los advisory.
 -- Adquirir TODOS los locks de filas por fecha, igual que el trigger de selección;
 -- las lecturas individuales siguientes no introducen otro orden de bloqueo.
 insert into operativo_privado.cargas(fecha) values(p_fecha) on conflict do nothing;
 perform 1 from operativo_privado.cargas
 where fecha in (cp.fecha,p_fecha) order by fecha for update;
 select * into c from operativo_privado.cargas where fecha=cp.fecha;
 if c.estado is distinct from 'cerrada' or p.estado<>'entrega_fallida'
 or p.venta_definitiva_snapshot is not null or p.venta_reconocida_en is not null
 or exists(select 1 from operativo_privado.entregas_definitivas where pedido_id=p.id)
 or p.preparacion_finalizada_en is null then raise exception 'PEDIDO_NO_REPROGRAMABLE'; end if;
 select * into destino from operativo_privado.cargas where fecha=p_fecha;
 if destino.estado is distinct from 'preparacion' then raise exception 'CARGA_NO_EDITABLE'; end if;
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
 insert into operativo_privado.permiso_reprogramacion values
 (p.id,txid_current(),auth.uid(),to_jsonb(p),despues,to_jsonb(cp),seleccion);
 update public.pedidos set fecha_entrega=p_fecha,estado='listo_despacho' where id=p.id;
 update operativo_privado.carga_pedidos set fecha=p_fecha,incluido=false,
 motivo=seleccion->>'motivo' where pedido_id=p.id;
 delete from operativo_privado.permiso_reprogramacion where pedido_id=p.id;
 -- La PK de carga_pedidos es por pedido: trasladar libera la asignación vieja.
 -- Su evidencia histórica permanece en resumen_cierre e historial_operativo.
 respuesta:=operativo_privado.completar_operacion(p.id,p_version_esperada,p_clave,
 'reprogramar_no_entregado',solicitud,null,p_motivo,
 jsonb_build_object('pedido',to_jsonb(p),'seleccion',to_jsonb(cp),'cierre',c.resumen_cierre,
 'fallo',to_jsonb(fallo)),
 jsonb_build_object('pedido',(select to_jsonb(pe) from public.pedidos pe where id=p.id),'seleccion',seleccion),
 jsonb_build_object('pedido_id',p.id,'fecha',p_fecha,'estado','listo_despacho','incluido',false));
 update operativo_privado.cargas set version=version+1 where fecha=p_fecha;
 insert into operativo_privado.historial_cargas(fecha,version,clave,actor,solicitud,anterior,resultado)
 values(p_fecha,destino.version+1,p_clave,auth.uid(),
 solicitud||jsonb_build_object('accion','recibir_reprogramado','pedido_id',p.id),to_jsonb(destino),
 jsonb_build_object('pedido_id',p.id,'version',destino.version+1,'origen',cp.fecha,
 'version_cierre_origen',c.version,'version_fallo',fallo.version,
 'version_operativa',respuesta->'version','clave_operativa',p_clave,
 'seleccion_anterior',to_jsonb(cp),'seleccion_nueva',seleccion));
 if p_fecha<(clock_timestamp() at time zone 'America/Santiago')::date then raise exception 'FECHA_REPROGRAMACION_INVALIDA'; end if;
 return respuesta;
end; $$;
alter function public.reprogramar_no_entregado_administrativo(uuid,bigint,uuid,date,text) owner to postgres;
revoke all on function public.reprogramar_no_entregado_administrativo(uuid,bigint,uuid,date,text) from public,anon,authenticated,service_role;
grant execute on function public.reprogramar_no_entregado_administrativo(uuid,bigint,uuid,date,text) to authenticated;

alter function operativo_privado.snapshot_cierre(date) owner to postgres;
alter function operativo_privado.proteger_cierre_carga() owner to postgres;
alter function operativo_privado.proteger_pedido_ruta_cerrada() owner to postgres;
alter function operativo_privado.proteger_orden_ruta_cerrada() owner to postgres;
revoke all on function operativo_privado.snapshot_cierre(date),operativo_privado.proteger_cierre_carga(),
 operativo_privado.proteger_pedido_ruta_cerrada(),operativo_privado.proteger_orden_ruta_cerrada() from public,anon,authenticated,service_role;
alter function public.leer_carga_jornada(date) owner to postgres;
revoke all on function public.leer_carga_jornada(date) from public,anon,authenticated,service_role;
grant execute on function public.leer_carga_jornada(date) to authenticated;
alter function public.revisar_cierre_ruta(date) owner to postgres;
alter function public.cerrar_ruta(date,bigint,uuid,text) owner to postgres;
alter function public.orden_ruta_dia(date,uuid[],bigint) owner to postgres;
revoke all on function public.revisar_cierre_ruta(date),public.cerrar_ruta(date,bigint,uuid,text),
 public.orden_ruta_dia(date,uuid[],bigint) from public,anon,authenticated,service_role;
grant execute on function public.revisar_cierre_ruta(date),public.cerrar_ruta(date,bigint,uuid,text),
 public.orden_ruta_dia(date,uuid[],bigint) to authenticated;
-- TRUNCATE no dispara las barreras de fila. Prohibirlo también con CASCADE.
create function operativo_privado.impedir_truncado_fase2() returns trigger
language plpgsql security definer set search_path=pg_catalog set timezone='UTC' set datestyle='ISO, YMD' as $$
begin raise exception 'TRUNCADO_NO_PERMITIDO_FASE2'; end; $$;
alter function operativo_privado.impedir_truncado_fase2() owner to postgres;
revoke all on function operativo_privado.impedir_truncado_fase2() from public,anon,authenticated,service_role;
do $$ declare tabla text; begin
 foreach tabla in array array['public.pedidos','public.items_pedido',
 'public.preparacion_items_pedido','public.rutas','public.paradas_ruta',
 'operativo_privado.cargas','operativo_privado.carga_pedidos'] loop
 execute format('create trigger fase2_no_truncable before truncate on %s for each statement execute function operativo_privado.impedir_truncado_fase2()',tabla);
 end loop;
end $$;
commit;
