-- HIDRO LEUFÚ / gxmkrerhuuzeeupjliap. PREPARADO, NO EJECUTADO.
-- Sólo SELECT de catálogo/datos; no llama RPC de negocio ni instala objetos.
-- query_to_xml recibe exclusivamente SELECT generado con identificadores citados.
-- Ejecutar en el futuro únicamente desde la conexión verificada externamente,
-- como postgres con BYPASSRLS/superusuario y en ventana sin escritores/DDL/jobs.
-- current_database() y el literal del proyecto NO acreditan identidad remota.
-- Falta de permisos, truncamiento de resultados o cualquier error invalidan el
-- diagnóstico. Exportar TODOS los conjuntos, incluidos XML, con acceso restringido.
-- No se exportan filas de Auth, sesiones ni tokens.

SELECT 'gxmkrerhuuzeeupjliap' AS proyecto_esperado,
 current_database(),current_user,now(),
 current_setting('session_replication_role') AS replicacion,
 (SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname=current_user) AS lectura_completa;

-- Contrato: TODAS las FK, incluso esquemas ajenos y acciones CASCADE/SET NULL.
SELECT conrelid::regclass AS hija,confrelid::regclass AS padre,conname,
 pg_get_constraintdef(oid,true) AS definicion,convalidated,condeferrable,condeferred
FROM pg_constraint WHERE contype='f' ORDER BY 1,3;

-- Cierre estructural descendente. Es una lista de inspección, NO de borrado.
-- Rutas/cargas son padres compartidos: se incluyen como semillas de inspección.
WITH RECURSIVE semillas(nombre) AS (VALUES
 ('public.pedidos'),('public.rutas'),('operativo_privado.cargas'),
 ('operativo_privado.rutas_multi')),
 arbol(tabla,camino) AS (
 SELECT to_regclass(nombre)::oid,ARRAY[to_regclass(nombre)::oid]
 FROM semillas WHERE to_regclass(nombre) IS NOT NULL
 UNION ALL
 SELECT f.conrelid,a.camino||f.conrelid FROM arbol a
 JOIN pg_constraint f ON f.confrelid=a.tabla AND f.contype='f'
 WHERE NOT f.conrelid=ANY(a.camino)
 )
SELECT DISTINCT tabla::regclass AS tabla_a_inspeccionar FROM arbol ORDER BY 1;

SELECT n.nspname,c.relname,c.relkind,c.relispartition,c.relrowsecurity,c.relforcerowsecurity,
 c.relacl,a.attname,format_type(a.atttypid,a.atttypmod) AS tipo,a.attnotnull,
 pg_get_expr(d.adbin,d.adrelid) AS defecto
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
LEFT JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped
LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum
WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname !~ '^pg_'
ORDER BY 1,2,a.attnum;
SELECT conrelid::regclass AS tabla,conname,contype,pg_get_constraintdef(oid,true)
FROM pg_constraint WHERE connamespace IN
 (SELECT oid FROM pg_namespace WHERE nspname NOT IN ('pg_catalog','information_schema') AND nspname !~ '^pg_')
ORDER BY 1,2;

-- Todos los triggers, incluidos internos y diferidos. El cuerpo permite
-- distinguir INSERT/UPDATE de DELETE y detectar efectos indirectos/externos.
SELECT t.tgrelid::regclass AS tabla,t.tgname,t.tgisinternal,t.tgenabled,
 pg_get_triggerdef(t.oid,true) AS definicion,p.oid::regprocedure AS funcion,
 pg_get_functiondef(p.oid) AS cuerpo
FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid ORDER BY 1,2;
SELECT p.oid::regprocedure AS funcion,p.prosecdef,p.provolatile,p.proconfig,
 pg_get_functiondef(p.oid) AS cuerpo
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname !~ '^pg_'
 AND p.prokind IN ('f','p') ORDER BY 1;
SELECT schemaname,viewname,definition FROM pg_views
WHERE schemaname NOT IN ('pg_catalog','information_schema') ORDER BY 1,2;
SELECT schemaname,matviewname,definition FROM pg_matviews ORDER BY 1,2;
SELECT schemaname,tablename,rulename,definition FROM pg_rules
WHERE schemaname NOT IN ('pg_catalog','information_schema') ORDER BY 1,2,3;
SELECT * FROM pg_policies ORDER BY schemaname,tablename,policyname;
SELECT * FROM information_schema.role_table_grants ORDER BY table_schema,table_name,grantee;
SELECT pg_describe_object(classid,objid,objsubid) AS dependiente,
 pg_describe_object(refclassid,refobjid,refobjsubid) AS referenciado,deptype
FROM pg_depend WHERE refclassid='pg_class'::regclass AND refobjid IN
 (SELECT c.oid FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname IN ('public','operativo_privado','produccion_privado'))
ORDER BY 2,1;

-- Cantidades exactas por tabla, sin asumir instalación de módulos manuales.
SELECT n.nspname,c.relname,query_to_xml(format(
 'SELECT count(*) AS filas FROM %I.%I',n.nspname,c.relname),false,true,'') AS cantidad
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE c.relkind IN ('r','p') AND NOT c.relispartition
 AND n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname !~ '^pg_'
ORDER BY 1,2;

-- Datos comerciales/operativos completos: comparar todas las filas para detectar
-- referencias sin FK, snapshots, resultados idempotentes y datos compartidos.
-- Ninguna fila se autoriza para eliminación por aparecer en este resultado.
-- Esquemas extra detectados arriba necesitan inspección equivalente antes de borrar.
SELECT n.nspname||'.'||c.relname AS tabla,
 query_to_xml(format('SELECT to_jsonb(t)::text AS fila FROM %I.%I t ORDER BY to_jsonb(t)::text',
 n.nspname,c.relname),false,true,'') AS filas_a_clasificar
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE c.relkind IN ('r','p') AND NOT c.relispartition
 AND n.nspname IN ('public','operativo_privado','produccion_privado') ORDER BY 1;

-- Bloqueos por DELETE: conteo de tabla NO demuestra que todas sus filas bloqueen.
-- Examinar cuerpo, OLD, estado, relaciones y triggers de sentencia.
SELECT t.tgrelid::regclass AS tabla,t.tgname,t.tgenabled,
 pg_get_triggerdef(t.oid,true) AS trigger_delete,p.oid::regprocedure AS funcion,
 pg_get_functiondef(p.oid) AS condicion_exacta
FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid
WHERE NOT t.tgisinternal AND (t.tgtype::integer & 8)=8 ORDER BY 1,2;

-- Filas directamente relacionadas por UUID con TODOS los pedidos e ítems.
-- La coincidencia textual encuentra también JSON anidado y texto; puede dar
-- falsos positivos y no sustituye inspección semántica (fechas, claves externas).
-- Es SELECT parametrizado por identificadores reales, sin tablas opcionales fijas.
SELECT n.nspname||'.'||c.relname AS tabla,
 query_to_xml(format($q$
  WITH ids AS (
   SELECT id::text AS id,'pedido'::text AS tipo FROM public.pedidos
   UNION ALL SELECT id::text,'item' FROM public.items_pedido)
  SELECT to_jsonb(t)::text AS fila,
   (SELECT jsonb_agg(jsonb_build_object('tipo',i.tipo,'id',i.id)) FROM ids i
    WHERE strpos(to_jsonb(t)::text,i.id)>0)::text AS referencias
  FROM %I.%I t WHERE EXISTS(SELECT 1 FROM ids i WHERE strpos(to_jsonb(t)::text,i.id)>0)
 $q$,n.nspname,c.relname),false,true,'') AS vinculadas_o_bloqueantes
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE c.relkind IN ('r','p') AND NOT c.relispartition
 AND n.nspname IN ('public','operativo_privado','produccion_privado') ORDER BY 1;

-- Aplicaciones son enlaces al pedido; NO autorizan borrar el pago.
SELECT to_jsonb(a) AS aplicacion_candidata,to_jsonb(p) AS pago_conservar
FROM public.aplicaciones_pago a JOIN public.pagos p ON p.id=a.pago_id ORDER BY a.id;
SELECT to_jsonb(a) AS ajuste_conservar FROM public.ajustes_cuenta_cliente a ORDER BY a.id;

-- Vistas contables reales: capturar situación inicial, no asumir saldo cero.
SELECT n.nspname||'.'||c.relname AS vista,
 query_to_xml(format('SELECT to_jsonb(v)::text AS fila FROM %I.%I v',n.nspname,c.relname),false,true,'') AS saldos
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relkind='v'
 AND c.relname ~ '(saldo|cuenta|beneficio|cupon)' ORDER BY 1;

-- Huella de contrato para 02: conservar literal exacto, no calcularla durante
-- el borrado como sustituto de revisión. Incluye FK, columnas/PK, funciones,
-- triggers, reglas, políticas y vistas; no valida filas ni identidad de proyecto.
SELECT md5(string_agg(def,E'\n' ORDER BY def)) AS contrato_revisado
FROM (
 SELECT 'con:'||to_jsonb(c)::text AS def FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace
 WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname !~ '^pg_'
 UNION ALL SELECT 'tr:'||to_jsonb(t)::text FROM pg_trigger t
 UNION ALL SELECT 'fn:'||to_jsonb(p)::text FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname !~ '^pg_' AND p.prokind IN ('f','p')
 UNION ALL SELECT 'col:'||to_jsonb(a)::text FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid
 JOIN pg_namespace n ON n.oid=c.relnamespace WHERE a.attnum>0 AND NOT a.attisdropped
 AND n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname !~ '^pg_'
 UNION ALL SELECT 'rule:'||to_jsonb(r)::text FROM pg_rewrite r
 UNION ALL SELECT 'policy:'||to_jsonb(p)::text FROM pg_policy p
) contrato;
