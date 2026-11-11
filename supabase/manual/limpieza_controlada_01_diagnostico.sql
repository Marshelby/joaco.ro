-- Proyecto esperado: gxmkrerhuuzeeupjliap. SOLO SELECT; no instala objetos.
-- Ejecutar manualmente como postgres desde la conexión verificada del proyecto.
-- Exportar TODOS los resultados en lugar seguro (contienen datos personales).
-- query_to_xml ejecuta únicamente los SELECT construidos abajo, sin RPC de negocio.
SELECT current_database(), current_user, now(),
 current_setting('request.jwt.claims', true) AS contexto,
 (SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname=current_user) AS lectura_completa_requerida;

-- Contrato remoto completo: columnas, FK (incluye cascadas/SET NULL), triggers,
-- cuerpos de funciones, reglas, RLS y permisos. Revisar también referencias JSON
-- y UUID sin FK: resultado, anterior/nuevo, actor, modificado_por, historiales.
SELECT n.nspname AS esquema,c.relname,c.relkind,c.relrowsecurity,c.relforcerowsecurity,
 c.relacl,a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull,
 pg_get_expr(d.adbin,d.adrelid) AS valor_default
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
LEFT JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped
LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum
WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname !~ '^pg_(toast|temp)'
ORDER BY n.nspname,c.relname,a.attnum;
SELECT conrelid::regclass AS hija,confrelid::regclass AS padre,conname,
 pg_get_constraintdef(oid) AS definicion,convalidated
FROM pg_constraint WHERE contype='f' ORDER BY 1,3;
SELECT t.tgrelid::regclass AS tabla,t.tgname,t.tgenabled,
 pg_get_triggerdef(t.oid) AS definicion,p.oid::regprocedure AS funcion,
 pg_get_functiondef(p.oid) AS cuerpo
FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid
WHERE NOT t.tgisinternal ORDER BY 1,2;
SELECT p.oid::regprocedure AS funcion,pg_get_functiondef(p.oid) AS cuerpo
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname IN ('public','operativo_privado','produccion_privado') AND p.prokind IN ('f','p')
ORDER BY 1;
SELECT * FROM pg_policies ORDER BY schemaname,tablename,policyname;
SELECT * FROM information_schema.role_table_grants ORDER BY table_schema,table_name,grantee;
SELECT schemaname,tablename,rulename,definition FROM pg_rules ORDER BY 1,2,3;

-- Conteos EXACTOS incluso para módulos manuales opcionales y esquemas desconocidos.
SELECT n.nspname,c.relname,
 (xpath('/table/row/n/text()',query_to_xml(
 format('SELECT count(*) AS n FROM %I.%I',n.nspname,c.relname),false,true,'')))[1]::text::bigint AS filas
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE c.relkind IN ('r','p') AND NOT c.relispartition
 AND n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname !~ '^pg_(toast|temp)'
ORDER BY 1,2;

-- Lista Auth: otros correos son CANDIDATOS, no se presume que todos sean pruebas.
-- No exportar contraseñas, tokens, identidades o sesiones.
SELECT u.id,u.email,u.created_at,u.last_sign_in_at,
 CASE WHEN lower(btrim(u.email)) IN ('elmarceloxd@gmail.com','garden.clean.quintaregion@gmail.com')
 THEN 'CONSERVAR_OBLIGATORIO' ELSE 'CANDIDATO_PRUEBA_REQUIERE_IDENTIFICACION' END AS decision,
 to_jsonb(p) AS perfil,c.id AS cliente_id,c.nombre
FROM auth.users u LEFT JOIN public.perfiles p ON p.usuario_id=u.id
LEFT JOIN public.clientes c ON c.usuario_id=u.id ORDER BY decision,u.email;
SELECT esperado.email,count(u.id) AS debe_ser_uno
FROM (VALUES ('elmarceloxd@gmail.com'),('garden.clean.quintaregion@gmail.com')) esperado(email)
LEFT JOIN auth.users u ON lower(btrim(u.email))=esperado.email GROUP BY esperado.email;

SELECT to_jsonb(c) AS cliente,
 CASE WHEN lower(btrim(u.email)) IN ('elmarceloxd@gmail.com','garden.clean.quintaregion@gmail.com')
 THEN 'CONSERVAR_OBLIGATORIO'
 WHEN c.usuario_id IS NULL THEN 'CONSERVAR_PREVENTIVO_ORIGEN_MANUAL_POR_VERIFICAR'
 ELSE 'AMBIGUO_PERSONAL_O_COMERCIAL_REVISAR' END AS decision,
 (concat_ws(' ',c.nombre,c.email,c.observaciones) ~* '(test|prueba|demo|dummy|fake|ejemplo)') AS senal_prueba_no_concluyente,
 (SELECT count(*) FROM public.pedidos p WHERE p.cliente_id=c.id) AS pedidos,
 (SELECT count(*) FROM public.direcciones_cliente d WHERE d.cliente_id=c.id) AS direcciones,
 (SELECT jsonb_agg(to_jsonb(d) ORDER BY d.id) FROM public.direcciones_cliente d WHERE d.cliente_id=c.id) AS detalle_direcciones
FROM public.clientes c LEFT JOIN auth.users u ON u.id=c.usuario_id ORDER BY c.id;

-- Pedidos completos: TODOS están dentro del objetivo, cualquiera sea su cliente.
SELECT to_jsonb(p) AS pedido_objetivo FROM public.pedidos p ORDER BY p.id;
SELECT to_jsonb(p) AS pago,
 (SELECT jsonb_agg(to_jsonb(a)) FROM public.aplicaciones_pago a WHERE a.pago_id=p.id) AS aplicaciones,
 CASE WHEN EXISTS(SELECT 1 FROM public.aplicaciones_pago a WHERE a.pago_id=p.id)
 THEN 'MIXTO_REVISAR_NO_BORRAR_PAGO_POR_ASOCIACION' ELSE 'INDEPENDIENTE_CONSERVAR_HASTA_CLASIFICAR' END AS decision
FROM public.pagos p ORDER BY p.id;
SELECT to_jsonb(a) AS ajuste_independiente_por_defecto FROM public.ajustes_cuenta_cliente a ORDER BY a.id;

-- Inventario fila por fila de TODOS los módulos de aplicación, incluidos posibles
-- pedidos, beneficios, mensajes, invitaciones, producción, repartidores e historiales.
-- Evita referencias a tablas opcionales ausentes. XML <fila> contiene JSON completo.
-- No copiar sin clasificar al manifiesto: varias tablas son comerciales/inmutables.
SELECT n.nspname||'.'||c.relname AS tabla,
 query_to_xml(format('SELECT to_jsonb(t)::text AS fila FROM %I.%I t ORDER BY to_jsonb(t)::text',n.nspname,c.relname),false,true,'') AS filas
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE c.relkind IN ('r','p') AND NOT c.relispartition
 AND n.nspname IN ('public','operativo_privado','produccion_privado') ORDER BY 1;
SELECT schemaname,viewname,definition FROM pg_views
WHERE schemaname IN ('public','operativo_privado','produccion_privado') ORDER BY 1,2;

-- Copiar esta huella SOLO después de revisar el contrato completo anterior.
SELECT md5(string_agg(def,E'\n' ORDER BY def)) AS contrato_revisado
FROM (
 SELECT 'fk:'||to_jsonb(c)::text AS def FROM pg_constraint c WHERE c.contype='f'
 UNION ALL SELECT 'tr:'||to_jsonb(t)::text FROM pg_trigger t WHERE NOT t.tgisinternal
 UNION ALL SELECT 'fn:'||to_jsonb(p)::text
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname !~ '^pg_' AND p.prokind IN ('f','p')
) contrato;
