-- HIDRO LEUFÚ / gxmkrerhuuzeeupjliap. PLANTILLA TRANSACCIONAL BLOQUEADA.
-- NO EJECUTADA NI VALIDADA CONTRA REMOTO. Leer 03-informe.md.
-- Alcance exclusivo pedidos y dependencias probadas. Ningún usuario se borra.
-- No ejecutar fragmentos. Ante error: ROLLBACK de la sesión, no continuar.
BEGIN ISOLATION LEVEL READ COMMITTED;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='120s';
SET LOCAL search_path=pg_catalog,pg_temp;

CREATE TEMP TABLE revision (
 proyecto text NOT NULL, conexion_verificada boolean NOT NULL,
 contrato text, responsable text, respaldo text,
 referencias_indirectas_revisadas boolean NOT NULL
) ON COMMIT DROP;
INSERT INTO revision VALUES ('gxmkrerhuuzeeupjliap',false,NULL,NULL,NULL,false);
-- Completar estos metadatos sólo con evidencia real del diagnóstico y respaldo.
-- No prueban identidad del servidor. No son una solicitud de confirmación.

CREATE TEMP TABLE borrar (
 orden integer NOT NULL, tabla text NOT NULL, clave jsonb NOT NULL,
 fila_esperada jsonb NOT NULL, motivo text NOT NULL,
 evidencia_exclusividad text NOT NULL,
 PRIMARY KEY(tabla,clave),
 CHECK(jsonb_typeof(clave)='object' AND clave<>'{}'::jsonb),
 CHECK(jsonb_typeof(fila_esperada)='object'),
 CHECK(length(btrim(motivo))>20 AND length(btrim(evidencia_exclusividad))>30)
) ON COMMIT DROP;
-- MANIFIESTO SIN FILAS INVENTADAS. Una fila por PK COMPLETA, JSON completo
-- del diagnóstico y justificación de propiedad exclusiva del pedido.
-- Incluir TODOS los pedidos y dependientes justificados; no objetivos ambiguos.
-- Orden de FK: hijos antes de padres. No aprovechar CASCADE ni SET NULL.
-- Ejemplo sólo de formato, NO datos utilizables:
-- INSERT INTO borrar VALUES (10,'public.items_pedido','{"id":"UUID_REAL"}',
-- '{...fila completa real...}','Item exclusivo del pedido identificado...',
-- 'pedido_id coincide con pedido objetivo; sin consumidores independientes...');

CREATE TEMP TABLE antes(tabla text NOT NULL,fila jsonb NOT NULL) ON COMMIT DROP;
CREATE TEMP TABLE objetivos(tabla text NOT NULL,fila jsonb NOT NULL) ON COMMIT DROP;
CREATE TEMP TABLE despues(tabla text NOT NULL,fila jsonb NOT NULL) ON COMMIT DROP;

DO $reinicio$
DECLARE r record; f record; n bigint; condicion text; huella text;
 hija text; padre text;
 permitidas text[] := ARRAY[
 'public.pedidos','public.items_pedido','public.preparacion_items_pedido',
 'public.historial_estados_pedido','public.aplicaciones_pago',
 'public.creaciones_pedidos_administrativas','public.auditoria_precios_pedido_administrativo',
 'public.beneficios_stacks','public.vinculos_items_posible_pedido',
 'public.paradas_ruta','public.rutas','public.correcciones_venta_entregada',
 'operativo_privado.versiones_pedido','operativo_privado.historial_operativo',
 'operativo_privado.carga_pedidos','operativo_privado.cargas','operativo_privado.historial_cargas',
 'operativo_privado.entregas_definitivas','operativo_privado.cobros_entrega','operativo_privado.pagos_entrega',
 'operativo_privado.reparto_asignaciones','operativo_privado.reparto_auditoria',
 'operativo_privado.ruta_multi_pedidos','operativo_privado.ruta_multi_autorizaciones',
 'operativo_privado.ruta_multi_repartidores','operativo_privado.ruta_multi_eventos',
 'operativo_privado.rutas_multi'];
BEGIN
 IF (SELECT count(*) FROM revision)<>1 OR NOT EXISTS(SELECT 1 FROM revision
 WHERE proyecto='gxmkrerhuuzeeupjliap' AND conexion_verificada
 AND referencias_indirectas_revisadas AND contrato IS NOT NULL
 AND length(btrim(responsable))>0 AND length(btrim(respaldo))>0)
 THEN RAISE EXCEPTION 'BLOQUEADO: falta contrato/diagnóstico/clasificación/conexión/respaldo'; END IF;
 IF current_user<>'postgres' OR NOT EXISTS(SELECT 1 FROM pg_roles
 WHERE rolname=current_user AND (rolsuper OR rolbypassrls))
 THEN RAISE EXCEPTION 'LECTURA_COMPLETA_POSTGRES_REQUERIDA'; END IF;
 IF current_setting('session_replication_role')<>'origin'
 THEN RAISE EXCEPTION 'TRIGGERS_DEBEN_SEGUIR_ACTIVOS'; END IF;
 IF NOT EXISTS(SELECT 1 FROM borrar) OR EXISTS(SELECT 1 FROM borrar WHERE NOT tabla=ANY(permitidas))
 THEN RAISE EXCEPTION 'MANIFIESTO_VACIO_O_FUERA_DE_ALCANCE'; END IF;

 -- Todas las tablas de usuario quedan bloqueadas para comprobar preservación
 -- exacta, incluidos TODOS los usuarios Auth y sus tablas internas. Sólo SELECT
 -- sobre datos conservados. Requiere permisos y ventana de mantenimiento.
 -- No cambios de ACL/RLS, ni secuencias, ni funciones. DDL externo debe estar detenido.
 FOR r IN SELECT c.oid,n.nspname,c.relname,c.relkind,c.relispartition
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE c.relkind IN ('r','p','f') AND c.relpersistence<>'t'
 AND n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname !~ '^pg_'
 ORDER BY n.nspname,c.relname LOOP
  IF r.relkind IN ('p','f') OR r.relispartition
  THEN RAISE EXCEPTION 'PARTICION_O_TABLA_REMOTA_REQUIERE_PLAN_ESPECIFICO: %.%',r.nspname,r.relname; END IF;
  EXECUTE format('LOCK TABLE %I.%I IN ACCESS EXCLUSIVE MODE NOWAIT',r.nspname,r.relname);
  EXECUTE format('INSERT INTO antes SELECT %L,to_jsonb(t) FROM %I.%I t',
   r.nspname||'.'||r.relname,r.nspname,r.relname);
 END LOOP;

 SELECT md5(string_agg(def,E'\n' ORDER BY def)) INTO huella FROM (
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
 IF huella IS DISTINCT FROM (SELECT contrato FROM revision)
 THEN RAISE EXCEPTION 'CONTRATO_REMOTO_NO_REVISADO_O_CAMBIADO'; END IF;

 FOR r IN SELECT * FROM borrar LOOP
  IF NOT EXISTS(SELECT 1 FROM pg_constraint c WHERE c.conrelid=to_regclass(r.tabla) AND c.contype='p'
   AND (SELECT array_agg(a.attname::text ORDER BY a.attname) FROM unnest(c.conkey) k(attnum)
   JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=k.attnum)=
   (SELECT array_agg(key ORDER BY key) FROM jsonb_object_keys(r.clave) key))
  THEN RAISE EXCEPTION 'EXIGIR_PK_COMPLETA: % %',r.tabla,r.clave; END IF;
  SELECT count(*) INTO n FROM antes WHERE tabla=r.tabla AND fila @> r.clave;
  IF n<>1 OR NOT EXISTS(SELECT 1 FROM antes WHERE tabla=r.tabla AND fila=r.fila_esperada AND fila @> r.clave)
  THEN RAISE EXCEPTION 'FILA_CAMBIADA_O_PK_NO_UNIVOCA: % %',r.tabla,r.clave; END IF;
  INSERT INTO objetivos SELECT tabla,fila FROM antes WHERE tabla=r.tabla AND fila=r.fila_esperada;
 END LOOP;
 IF EXISTS(SELECT 1 FROM antes a WHERE a.tabla='public.pedidos'
 AND NOT EXISTS(SELECT 1 FROM objetivos o WHERE o.tabla=a.tabla AND o.fila=a.fila))
 THEN RAISE EXCEPTION 'MANIFIESTO_NO_INCLUYE_TODOS_LOS_PEDIDOS'; END IF;

 -- Contabilidad/beneficios compartidos: no borrar auditoría que explica un ajuste
 -- conservado, ni stacks que sustentan un cupón. Sin desvincular/recalcular.
 IF EXISTS(SELECT 1 FROM objetivos WHERE
 (tabla='public.correcciones_venta_entregada' AND fila->>'ajuste_id' IS NOT NULL) OR
 (tabla='public.beneficios_stacks' AND fila->>'cupon_id' IS NOT NULL))
 THEN RAISE EXCEPTION 'DEPENDENCIA_MIXTA_AJUSTE_O_CUPON_CONSERVADO'; END IF;

 -- Respetar protecciones ANTES de borrar hijos: no retirar primero la evidencia
 -- de cierre para conseguir que un trigger deje de verlo. Tampoco fabricar
 -- permiso_reprogramacion/reparto_capacidad/ruta_multi_capacidad.
 IF EXISTS(SELECT 1 FROM antes WHERE tabla IN
 ('operativo_privado.cargas','operativo_privado.rutas_multi') AND fila->>'estado'='cerrada')
 THEN RAISE EXCEPTION 'RUTA_CERRADA: requiere mantenimiento separado, sin reabrir ni ocultar vínculos'; END IF;
 IF EXISTS(SELECT 1 FROM antes WHERE tabla IN
 ('operativo_privado.permiso_reprogramacion','operativo_privado.reparto_capacidad','operativo_privado.ruta_multi_capacidad'))
 THEN RAISE EXCEPTION 'CAPACIDADES_OPERATIVAS_PRESENTES: investigar, no borrar ni reutilizar'; END IF;

 -- Toda FK entrante debe apuntar a otra fila objetivo que se borre ANTES.
 -- Bloquea por igual RESTRICT, NO ACTION, CASCADE y SET NULL.
 FOR f IN SELECT * FROM pg_constraint WHERE contype='f' LOOP
  SELECT n.nspname||'.'||c.relname INTO hija FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.oid=f.conrelid;
  SELECT n.nspname||'.'||c.relname INTO padre FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.oid=f.confrelid;
  SELECT string_agg(format('(h.fila->%L <> ''null''::jsonb AND h.fila->%L=p.fila->%L)',
   ha.attname,ha.attname,pa.attname),' AND ' ORDER BY k.ord) INTO condicion
  FROM unnest(f.conkey,f.confkey) WITH ORDINALITY k(h,p,ord)
  JOIN pg_attribute ha ON ha.attrelid=f.conrelid AND ha.attnum=k.h
  JOIN pg_attribute pa ON pa.attrelid=f.confrelid AND pa.attnum=k.p;
  EXECUTE format('SELECT count(*) FROM antes h JOIN objetivos p ON %s
   WHERE h.tabla=$1 AND p.tabla=$2 AND NOT EXISTS
   (SELECT 1 FROM objetivos o JOIN borrar bh ON bh.tabla=o.tabla AND bh.fila_esperada=o.fila
    JOIN borrar bp ON bp.tabla=p.tabla AND bp.fila_esperada=p.fila
    WHERE o.tabla=h.tabla AND o.fila=h.fila AND bh.orden<bp.orden)',condicion)
   INTO n USING hija,padre;
  IF n>0 THEN RAISE EXCEPTION 'FK_BLOQUEANTE_O_ORDEN_INVALIDO: % hija=% padre=% filas=%',f.conname,hija,padre,n; END IF;
 END LOOP;

 -- Conservación semántica: ningún UUID de PK objetivo puede permanecer en una
 -- fila conservada de cualquier esquema, aunque esté incrustado en JSON/texto.
 -- Es conservador: falsos positivos abortan. Fechas/enteros requieren revisión
 -- manual de exclusividad, sobre todo cargas y auditoría de repartidores.
 FOR r IN SELECT b.tabla,b.clave,v.value #>> '{}' AS id FROM borrar b
 CROSS JOIN LATERAL jsonb_each(b.clave) v
 WHERE jsonb_typeof(v.value)='string'
 AND (v.value #>> '{}') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' LOOP
  SELECT count(*) INTO n FROM antes a WHERE strpos(a.fila::text,r.id)>0
  AND NOT EXISTS(SELECT 1 FROM objetivos o WHERE o.tabla=a.tabla AND o.fila=a.fila);
  IF n>0 THEN RAISE EXCEPTION 'REFERENCIA_INDIRECTA_CONSERVADA: % % (% filas)',r.tabla,r.clave,n; END IF;
 END LOOP;

 -- Cierre conservador: CUALQUIER trigger DELETE no interno en una tabla objetivo
 -- bloquea esta plantilla, aun si su condición pudiera resultar falsa. No usar
 -- orden de DELETE para esquivar barreras. El diagnóstico muestra nombre/cuerpo.
 -- Esto abarca inmutabilidad, cierres y barreras multi, sin heurísticas por nombre.
 SELECT t.tgrelid::regclass AS tabla,t.tgname,p.oid::regprocedure AS funcion INTO r
 FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid
 WHERE NOT t.tgisinternal AND (t.tgtype::integer & 8)=8
 AND EXISTS(SELECT 1 FROM objetivos o WHERE to_regclass(o.tabla)=t.tgrelid)
 ORDER BY t.tgrelid,t.tgname LIMIT 1;
 IF FOUND THEN RAISE EXCEPTION 'TRIGGER_DELETE_REQUIERE_MANTENIMIENTO_SEPARADO: % / % / %',r.tabla,r.tgname,r.funcion; END IF;
 IF EXISTS(SELECT 1 FROM pg_rewrite rw WHERE rw.ev_type<>'1'
 AND EXISTS(SELECT 1 FROM objetivos o WHERE to_regclass(o.tabla)=rw.ev_class))
 THEN RAISE EXCEPTION 'REGLA_DE_ESCRITURA_REQUIERE_PLAN_ESPECIFICO'; END IF;

 -- Único DML persistente permitido: DELETE exacto de las filas del manifiesto.
 FOR r IN SELECT * FROM borrar ORDER BY orden,tabla,clave::text LOOP
  EXECUTE format('DELETE FROM %s t WHERE to_jsonb(t)=$1',to_regclass(r.tabla)) USING r.fila_esperada;
  GET DIAGNOSTICS n=ROW_COUNT;
  IF n<>1 THEN RAISE EXCEPTION 'DELETE_NO_EXACTO: % %',r.tabla,r.clave; END IF;
 END LOOP;
 SET CONSTRAINTS ALL IMMEDIATE;

 FOR r IN SELECT c.oid,n.nspname,c.relname FROM pg_class c
 JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE c.relkind='r' AND c.relpersistence<>'t'
 AND n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname !~ '^pg_'
 ORDER BY n.nspname,c.relname LOOP
  EXECUTE format('INSERT INTO despues SELECT %L,to_jsonb(t) FROM %I.%I t',
   r.nspname||'.'||r.relname,r.nspname,r.relname);
 END LOOP;
 -- Multiconjuntos exactos, no sólo cantidades/huellas: nada fuera del manifiesto
 -- puede desaparecer, modificarse o aparecer. Incluye TODAS las filas Auth,
 -- perfiles/clientes/direcciones/catálogo/proveedores/configuración/pagos/ajustes.
 IF EXISTS(
  (SELECT tabla,fila FROM despues EXCEPT ALL
   SELECT a.tabla,a.fila FROM antes a WHERE NOT EXISTS
   (SELECT 1 FROM objetivos o WHERE o.tabla=a.tabla AND o.fila=a.fila))
  UNION ALL
  (SELECT a.tabla,a.fila FROM antes a WHERE NOT EXISTS
   (SELECT 1 FROM objetivos o WHERE o.tabla=a.tabla AND o.fila=a.fila)
   EXCEPT ALL SELECT tabla,fila FROM despues))
 THEN RAISE EXCEPTION 'CONSERVACION_EXACTA_FALLIDA: rollback obligatorio'; END IF;
 IF EXISTS(SELECT 1 FROM public.pedidos)
 THEN RAISE EXCEPTION 'PEDIDOS_REMANENTES'; END IF;
END;
$reinicio$;

SELECT tabla,count(*) AS filas_previstas FROM objetivos GROUP BY tabla ORDER BY tabla;
SELECT 'Conservación exacta verificada dentro de la transacción; termina en ROLLBACK' AS resultado;
-- ENSAYO POR DEFECTO. No sustituir por COMMIT con bloqueos pendientes ni ejecutar
-- como limpieza final sin versión completada con los resultados remotos reales.
ROLLBACK;
