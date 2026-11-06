-- DIAGNÓSTICO EXCLUSIVAMENTE DE LECTURA. Proyecto a seleccionar en Dashboard:
-- gxmkrerhuuzeeupjliap. La identidad del proyecto se confirma en la UI/URL;
-- current_database() suele ser postgres y NO identifica el proyecto.
-- Ejecutar como postgres. Exportar TODOS los resultados sin truncarlos.
-- No invoca RPC de negocio ni EXPLAIN ANALYZE. No aplicar migraciones aquí.
begin transaction isolation level repeatable read read only;
select version(), current_database(), current_user, session_user,
 current_setting('server_version_num') as server_version_num,
 current_setting('search_path') as search_path,
 current_setting('TimeZone') as timezone,
 current_setting('transaction_read_only') as solo_lectura,
 clock_timestamp() as reloj, (clock_timestamp() at time zone 'America/Santiago')::date as hoy,
 to_regclass('supabase_migrations.schema_migrations') as historial;

select nspname, pg_get_userbyid(nspowner) as owner, nspacl
from pg_namespace where nspname in ('public','auth','operativo_privado','supabase_migrations');
select rolname, rolsuper, rolinherit, rolcanlogin, rolbypassrls
from pg_roles order by rolname;
select pg_get_userbyid(roleid) as rol,pg_get_userbyid(member) as miembro,admin_option
from pg_auth_members order by 1,2;
select pg_get_userbyid(defaclrole) as owner,n.nspname,d.defaclobjtype,d.defaclacl
from pg_default_acl d left join pg_namespace n on n.oid=d.defaclnamespace;
select evtname,evtevent,evtenabled,evtfoid::regprocedure,evttags from pg_event_trigger;
select extname,extversion,n.nspname from pg_extension e join pg_namespace n on n.oid=e.extnamespace;

-- Columnas reales, tipos, orden físico, generación/defaults, ACL de columna.
select n.nspname,c.relname,pg_get_userbyid(c.relowner) as owner,c.relkind,
 c.relrowsecurity,c.relforcerowsecurity,c.relacl,a.attnum,a.attname,
 format_type(a.atttypid,a.atttypmod) as tipo,a.attnotnull,a.attgenerated,
 pg_get_expr(d.adbin,d.adrelid) as expresion,a.attacl
from pg_class c join pg_namespace n on n.oid=c.relnamespace
join pg_attribute a on a.attrelid=c.oid and a.attnum>0 and not a.attisdropped
left join pg_attrdef d on d.adrelid=c.oid and d.adnum=a.attnum
where n.nspname in ('public','operativo_privado') and c.relkind in ('r','p','v','m','f')
order by n.nspname,c.relname,a.attnum;
select n.nspname,c.relname,co.conname,co.contype,co.convalidated,
 co.condeferrable,co.condeferred,pg_get_constraintdef(co.oid,true) as definicion
from pg_constraint co join pg_class c on c.oid=co.conrelid
join pg_namespace n on n.oid=c.relnamespace
where n.nspname in ('public','operativo_privado') order by 1,2,3;
select schemaname,tablename,indexname,indexdef from pg_indexes
where schemaname in ('public','operativo_privado') order by 1,2,3;
select n.nspname,c.relname,i.indexrelid::regclass as indice,i.indisvalid,i.indisready
from pg_index i join pg_class c on c.oid=i.indrelid
join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','operativo_privado');
select n.nspname,t.typname,e.enumlabel,e.enumsortorder from pg_enum e
join pg_type t on t.oid=e.enumtypid join pg_namespace n on n.oid=t.typnamespace
where n.nspname='public' order by 1,2,4;

-- Incluye triggers internos (FK), estado de activación y funciones asociadas.
select n.nspname,c.relname,t.tgname,t.tgenabled,t.tgisinternal,
 t.tgfoid::regprocedure as funcion,pg_get_triggerdef(t.oid,true) as definicion
from pg_trigger t join pg_class c on c.oid=t.tgrelid
join pg_namespace n on n.oid=c.relnamespace
where n.nspname in ('public','operativo_privado') order by 1,2,3;
select * from pg_policies where schemaname in ('public','operativo_privado') order by schemaname,tablename,policyname;

-- TODAS las sobrecargas, nombres de argumentos, defaults, retorno, propietario,
-- SECURITY DEFINER/INVOKER, configuración y ACL. No limitar a la firma deseada.
select n.nspname,p.proname,p.oid::regprocedure as firma,
 pg_get_function_arguments(p.oid) as argumentos,
 pg_get_function_result(p.oid) as retorno,
 pg_get_userbyid(p.proowner) as owner,p.prosecdef,p.provolatile,p.proconfig,p.proacl,
 md5(p.prosrc) as md5_cuerpo,pg_get_functiondef(p.oid) as definicion
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname in ('public','operativo_privado') and p.prokind in ('f','p')
order by n.nspname,p.proname,p.oid;
select n.nspname,c.relname,c.reloptions,c.relacl,pg_get_viewdef(c.oid,true) as definicion
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname in ('public','operativo_privado') and c.relkind in ('v','m') order by 1,2;

-- Dependencias registradas en ambos sentidos. PL/pgSQL y SQL dinámico pueden
-- NO registrar referencias de cuerpos: revisar también todas las definiciones.
with objetivos as (
 select 'pg_class'::regclass::oid as clase,c.oid from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='operativo_privado' or (n.nspname='public' and c.relname in ('pedidos','items_pedido','preparacion_items_pedido','pagos','aplicaciones_pago'))
 union all
 select 'pg_proc'::regclass::oid,p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='operativo_privado' or (n.nspname='public' and p.proname ~ '(pedido|preparacion|carga|pago)')
)
select distinct pg_describe_object(d.classid,d.objid,d.objsubid) as objeto,
 pg_describe_object(d.refclassid,d.refobjid,d.refobjsubid) as referencia,d.deptype
from pg_depend d where exists(select 1 from objetivos o
 where (d.classid=o.clase and d.objid=o.oid) or (d.refclassid=o.clase and d.refobjid=o.oid)) order by 1,2;

-- Permisos efectivos: detectan herencia. ACL crudas anteriores incluyen PUBLIC.
select r.rolname,n.nspname,c.relname,v.privilegio,
 has_table_privilege(r.oid,c.oid,v.privilegio) as efectivo_tabla,
 case when v.privilegio in ('INSERT','UPDATE') then has_any_column_privilege(r.oid,c.oid,v.privilegio) end as efectivo_alguna_columna
from pg_roles r cross join pg_class c join pg_namespace n on n.oid=c.relnamespace
cross join (values ('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER')) v(privilegio)
where r.rolname in ('anon','authenticated','service_role')
and ((n.nspname='public' and c.relname in ('pedidos','items_pedido','preparacion_items_pedido','pagos','aplicaciones_pago','historial_estados_pedido')) or n.nspname='operativo_privado')
and c.relkind in ('r','p','v') order by 1,2,3,4;
select r.rolname,n.nspname,has_schema_privilege(r.oid,n.oid,'USAGE') as usage,
 has_schema_privilege(r.oid,n.oid,'CREATE') as crear
from pg_roles r cross join pg_namespace n
where r.rolname in ('anon','authenticated','service_role') and n.nspname in ('public','operativo_privado');
select r.rolname,p.oid::regprocedure as firma,has_function_privilege(r.oid,p.oid,'EXECUTE') as ejecutar
from pg_roles r cross join pg_proc p join pg_namespace n on n.oid=p.pronamespace
where r.rolname in ('anon','authenticated','service_role')
and n.nspname in ('public','operativo_privado') and p.prokind='f' order by 1,2;

-- Tamaños y actividad. No cancelar sesiones ni desbloquear mediante escrituras.
select n.nspname,c.relname,pg_total_relation_size(c.oid) as bytes,c.reltuples as filas_estimadas
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname in ('public','operativo_privado') and c.relkind in ('r','p') order by bytes desc;
select pid,usename,application_name,state,xact_start,query_start,wait_event_type,wait_event,
 pg_blocking_pids(pid) as bloqueadores from pg_stat_activity
where datname=current_database() and pid<>pg_backend_pid() order by xact_start nulls last;
select pid,relation::regclass,mode,granted from pg_locks
where database=(select oid from pg_database where datname=current_database()) order by pid,relation;
commit;
