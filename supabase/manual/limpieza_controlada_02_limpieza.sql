-- BORRADOR BLOQUEADO. Proyecto gxmkrerhuuzeeupjliap.
-- Requiere diagnóstico revisado, clasificación fila a fila y conexión verificada.
-- No ejecutar por selección parcial. No sustituir ROLLBACK sin revisar resultados.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';
SET LOCAL search_path = pg_catalog, pg_temp;

CREATE TEMP TABLE revision (
 proyecto text, diagnostico_revisado boolean, responsable text,
 contrato text, referencia_respaldo text
) ON COMMIT DROP;
INSERT INTO revision VALUES ('gxmkrerhuuzeeupjliap',false,NULL,NULL,NULL);
-- Completar localmente después del diagnóstico; proyecto es declaración del
-- operador, NO prueba de identidad del servidor. Verificar URL fuera de SQL.

CREATE TEMP TABLE conservar_usuarios (id uuid PRIMARY KEY,email text UNIQUE NOT NULL) ON COMMIT DROP;
-- INSERT explícitos con los dos UUID y sus correos obtenidos del diagnóstico.
CREATE TEMP TABLE conservar_clientes (id uuid PRIMARY KEY,motivo text NOT NULL) ON COMMIT DROP;
-- INSERT explícitos de TODOS los clientes a conservar: protegidos, manuales sin
-- auth, comerciales vinculados y ambiguos pendientes. Vacío => bloqueo.
CREATE TEMP TABLE borrar (
 orden integer NOT NULL, tabla text NOT NULL, clave jsonb NOT NULL,
 motivo text NOT NULL CHECK(length(btrim(motivo))>15),
 PRIMARY KEY(tabla,clave), CHECK(jsonb_typeof(clave)='object' AND clave<>'{}'::jsonb)
) ON COMMIT DROP;
-- Manifiesto EXPLÍCITO, una fila por registro. clave debe ser la PK completa.
-- Ejemplo documental, no ejecutable:
-- INSERT INTO borrar VALUES (10,'public.items_pedido','{"id":"UUID_REVISADO"}',
-- 'Item del pedido de prueba identificado en el diagnóstico revisado');
-- Orden: dependientes antes de padres, Auth al final. No generar por CASCADE.
-- Revisar claves compuestas, tablas sin FK, JSON, Auth y Storage por separado.

CREATE TEMP TABLE antes (tabla text NOT NULL,fila jsonb NOT NULL) ON COMMIT DROP;
CREATE TEMP TABLE objetivos (tabla text NOT NULL,fila jsonb NOT NULL) ON COMMIT DROP;

DO $limpieza$
DECLARE r record; f record; v record; n bigint; condicion text; huella text;
 protegidos uuid[]; permitidas text[] := ARRAY[
 'public.perfiles','public.clientes','public.direcciones_cliente',
 'public.pedidos','public.items_pedido','public.preparacion_items_pedido',
 'public.historial_estados_pedido','public.rutas','public.paradas_ruta',
 'public.aplicaciones_pago','public.pagos','public.ajustes_cuenta_cliente',
 'public.cupones_cliente','public.beneficios_stacks','public.mensajes_conversacion',
 'public.conversaciones_cliente','public.invitaciones_acceso_cliente',
 'public.posibles_pedidos','public.items_posible_pedido','public.historial_posibles_pedidos',
 'public.vinculos_items_posible_pedido','public.creaciones_pedidos_administrativas',
 'public.auditoria_precios_pedido_administrativo','public.correcciones_venta_entregada',
 'operativo_privado.versiones_pedido','operativo_privado.historial_operativo',
 'operativo_privado.cargas','operativo_privado.carga_pedidos','operativo_privado.historial_cargas',
 'operativo_privado.entregas_definitivas','operativo_privado.cobros_entrega','operativo_privado.pagos_entrega',
 'operativo_privado.correcciones_pago','operativo_privado.repartidores',
 'operativo_privado.reparto_asignaciones','operativo_privado.reparto_auditoria',
 'operativo_privado.permiso_reprogramacion','operativo_privado.rutas_multi',
 'operativo_privado.ruta_multi_pedidos','operativo_privado.ruta_multi_repartidores',
 'operativo_privado.ruta_multi_autorizaciones','operativo_privado.ruta_multi_eventos',
 'auth.users'];
BEGIN
 IF NOT EXISTS(SELECT 1 FROM revision WHERE proyecto='gxmkrerhuuzeeupjliap'
 AND diagnostico_revisado AND length(btrim(responsable))>0 AND contrato IS NOT NULL
 AND length(btrim(referencia_respaldo))>0) THEN
 RAISE EXCEPTION 'BLOQUEADO: revisar diagnóstico, respaldo y manifiesto antes de autorizar'; END IF;
 IF current_user<>'postgres' OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND (rolsuper OR rolbypassrls))
 THEN RAISE EXCEPTION 'REQUIERE_POSTGRES_CON_LECTURA_COMPLETA'; END IF;
 IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'AISLAMIENTO_INCOMPATIBLE_CON_TRIGGERS'; END IF;
 IF (SELECT count(*) FROM conservar_usuarios)<>2 OR EXISTS(
 SELECT 1 FROM conservar_usuarios k FULL JOIN (
 SELECT id,lower(btrim(email)) email FROM auth.users
 WHERE lower(btrim(email)) IN ('elmarceloxd@gmail.com','garden.clean.quintaregion@gmail.com')
 ) u ON u.id=k.id AND u.email=k.email WHERE k.id IS NULL OR u.id IS NULL)
 THEN RAISE EXCEPTION 'LISTA_AUTH_PROTEGIDA_INVALIDA'; END IF;
 SELECT array_agg(id) INTO protegidos FROM conservar_usuarios;
 IF NOT EXISTS(SELECT 1 FROM conservar_clientes) OR EXISTS(
 SELECT 1 FROM public.clientes c WHERE (c.usuario_id IS NULL OR c.usuario_id=ANY(protegidos))
 AND NOT EXISTS(SELECT 1 FROM conservar_clientes k WHERE k.id=c.id))
 OR EXISTS(SELECT 1 FROM conservar_clientes k WHERE NOT EXISTS(SELECT 1 FROM public.clientes c WHERE c.id=k.id))
 THEN RAISE EXCEPTION 'LISTA_CLIENTES_INCOMPLETA'; END IF;
 IF NOT EXISTS(SELECT 1 FROM borrar) OR EXISTS(SELECT 1 FROM borrar WHERE NOT(tabla=ANY(permitidas)))
 THEN RAISE EXCEPTION 'MANIFIESTO_VACIO_O_TABLA_NO_AUTORIZADA'; END IF;

 -- Bloquear todas las tablas persistentes de usuario, incluyendo referencias
 -- cruzadas en otros esquemas. Sin locks parciales ni continuidad ante error.
 FOR r IN SELECT c.oid,n.nspname,c.relname,c.relkind,c.relispartition
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE c.relkind IN ('r','p','f') AND c.relpersistence<>'t'
 AND n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname !~ '^pg_(toast|temp)'
 ORDER BY n.nspname,c.relname LOOP
 IF r.relkind='f' THEN RAISE EXCEPTION 'TABLA_REMOTA_NO_REVISADA: %.%',r.nspname,r.relname; END IF;
 EXECUTE format('LOCK TABLE %I.%I IN ACCESS EXCLUSIVE MODE NOWAIT',r.nspname,r.relname);
 IF NOT r.relispartition THEN
 EXECUTE format('INSERT INTO antes SELECT %L,to_jsonb(t) FROM %I.%I t',r.nspname||'.'||r.relname,r.nspname,r.relname);
 END IF;
 END LOOP;
 SELECT md5(string_agg(def,E'\n' ORDER BY def)) INTO huella FROM (
 SELECT 'fk:'||to_jsonb(c)::text AS def FROM pg_constraint c WHERE c.contype='f'
 UNION ALL SELECT 'tr:'||to_jsonb(t)::text FROM pg_trigger t WHERE NOT t.tgisinternal
 UNION ALL SELECT 'fn:'||to_jsonb(p)::text
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname !~ '^pg_' AND p.prokind IN ('f','p')
 ) contrato;
 IF huella IS DISTINCT FROM (SELECT contrato FROM revision) THEN RAISE EXCEPTION 'CONTRATO_DESCONOCIDO_O_MODIFICADO'; END IF;
 FOR r IN SELECT * FROM borrar LOOP
 SELECT count(*) INTO n FROM antes WHERE tabla=r.tabla AND fila @> r.clave;
 IF n<>1 THEN RAISE EXCEPTION 'CLAVE_NO_UNIVOCA_O_DATOS_CAMBIADOS: % %',r.tabla,r.clave; END IF;
 -- Exigir exactamente los nombres de columnas de PK, no un filtro libre.
 IF NOT EXISTS(SELECT 1 FROM pg_constraint c WHERE c.conrelid=to_regclass(r.tabla) AND c.contype='p'
 AND (SELECT array_agg(a.attname::text ORDER BY a.attname) FROM unnest(c.conkey) k(attnum)
 JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=k.attnum)=
 (SELECT array_agg(key ORDER BY key) FROM jsonb_object_keys(r.clave) key))
 THEN RAISE EXCEPTION 'EXIGIR_PK_COMPLETA: %',r.tabla; END IF;
 INSERT INTO objetivos SELECT tabla,fila FROM antes WHERE tabla=r.tabla AND fila @> r.clave;
 END LOOP;
 IF EXISTS(SELECT 1 FROM objetivos o WHERE
 (o.tabla='auth.users' AND (o.fila->>'id')::uuid=ANY(protegidos)) OR
 (o.tabla='public.perfiles' AND (o.fila->>'usuario_id')::uuid=ANY(protegidos)) OR
 (o.tabla='public.clientes' AND (o.fila->>'id')::uuid IN (SELECT id FROM conservar_clientes)) OR
 (o.tabla='public.direcciones_cliente' AND ((o.fila->>'cliente_id')::uuid IN (SELECT id FROM conservar_clientes)
 OR o.fila->>'ambito' IS DISTINCT FROM 'personal')))
 THEN RAISE EXCEPTION 'INTENTO_BORRAR_DATOS_PROTEGIDOS_O_DIRECCION_AMBIGUA'; END IF;
 IF EXISTS(SELECT 1 FROM antes a WHERE a.tabla='public.pedidos' AND NOT EXISTS(
 SELECT 1 FROM objetivos o WHERE o.tabla=a.tabla AND o.fila=a.fila)) OR EXISTS(
 SELECT 1 FROM auth.users u WHERE NOT(u.id=ANY(protegidos)) AND NOT EXISTS(
 SELECT 1 FROM objetivos o WHERE o.tabla='auth.users' AND o.fila->>'id'=u.id::text))
 THEN RAISE EXCEPTION 'OBJETIVO_INCOMPLETO_PEDIDOS_O_AUTH: CLASIFICAR_TODOS'; END IF;

 -- Toda fila hija de un padre objetivo debe figurar explícitamente como objetivo.
 -- Bloquea incluso SET NULL/CASCADE: jamás convertir referencias en pérdida implícita.
 FOR f IN SELECT * FROM pg_constraint WHERE contype='f' LOOP
 SELECT string_agg(format('(h.fila->%L <> ''null''::jsonb AND h.fila->%L=p.fila->%L)',ha.attname,ha.attname,pa.attname),' AND ' ORDER BY k.ord)
 INTO condicion FROM unnest(f.conkey,f.confkey) WITH ORDINALITY k(h,p,ord)
 JOIN pg_attribute ha ON ha.attrelid=f.conrelid AND ha.attnum=k.h
 JOIN pg_attribute pa ON pa.attrelid=f.confrelid AND pa.attnum=k.p;
 EXECUTE format('SELECT count(*) FROM antes h JOIN objetivos p ON %s WHERE h.tabla=%L AND p.tabla=%L AND NOT EXISTS(SELECT 1 FROM objetivos o WHERE o.tabla=h.tabla AND o.fila=h.fila)',
 condicion, (SELECT n.nspname||'.'||c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.oid=f.conrelid),
 (SELECT n.nspname||'.'||c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.oid=f.confrelid)) INTO n;
 IF n>0 THEN RAISE EXCEPTION 'DEPENDENCIA_NO_AUTORIZADA: % (% filas)',f.conname,n; END IF;
 END LOOP;
 -- Sin capacidades artificiales ni bypass de triggers. Los DELETE protegidos
 -- se bloquean ANTES de mutar, aunque se haya copiado el contrato revisado.
 IF EXISTS(SELECT 1 FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid
 WHERE NOT t.tgisinternal AND (t.tgtype::integer & 8)=8 AND t.tgenabled<>'D'
 AND EXISTS(SELECT 1 FROM objetivos o WHERE to_regclass(o.tabla)=t.tgrelid)
 AND (p.proname ~ '(impedir_mutacion|inmutable)' OR t.tgname ~ 'inmutable'))
 THEN RAISE EXCEPTION 'DATOS_INMUTABLES: LIMPIEZA_TOTAL_INCOMPATIBLE_CON_PROTECCIONES_ACTUALES'; END IF;

 FOR r IN SELECT * FROM borrar ORDER BY orden,tabla,clave::text LOOP
 EXECUTE format('DELETE FROM %s t WHERE to_jsonb(t) @> $1',to_regclass(r.tabla)) USING r.clave;
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>1 THEN RAISE EXCEPTION 'DELETE_NO_EXACTO: % %',r.tabla,r.clave; END IF;
 END LOOP;
 SET CONSTRAINTS ALL IMMEDIATE;
 -- Comparación exacta multiconjunto: todos los demás registros deben quedar
 -- idénticos. Detecta escrituras inesperadas de triggers y cascadas.
 FOR r IN SELECT DISTINCT tabla FROM antes UNION SELECT unnest(permitidas) LOOP
 IF to_regclass(r.tabla) IS NULL THEN CONTINUE; END IF;
 EXECUTE format('SELECT count(*) FROM ((SELECT to_jsonb(t) fila FROM %s t EXCEPT ALL SELECT fila FROM antes WHERE tabla=$1 AND NOT EXISTS(SELECT 1 FROM objetivos o WHERE o.tabla=antes.tabla AND o.fila=antes.fila)) UNION ALL (SELECT fila FROM antes WHERE tabla=$1 AND NOT EXISTS(SELECT 1 FROM objetivos o WHERE o.tabla=antes.tabla AND o.fila=antes.fila) EXCEPT ALL SELECT to_jsonb(t) FROM %s t)) diferencias',to_regclass(r.tabla),to_regclass(r.tabla)) INTO n USING r.tabla;
 IF n<>0 THEN RAISE EXCEPTION 'CONSERVACION_O_BORRADO_NO_EXACTO: %',r.tabla; END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM public.pedidos) OR (SELECT count(*) FROM auth.users)<>2
 THEN RAISE EXCEPTION 'COMPROBACION_FINAL_FALLIDA'; END IF;
END;
$limpieza$;
SELECT tabla,count(*) AS filas_previstas FROM objetivos GROUP BY tabla ORDER BY tabla;
-- ENSAYO por defecto: ninguna modificación persistirá. Sólo una versión revisada
-- y autorizada puede sustituir este ROLLBACK por COMMIT, ejecutando TODO el archivo.
ROLLBACK;
